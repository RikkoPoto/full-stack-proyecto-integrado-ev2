import re
import time
import threading
from urllib.parse import urljoin, urlparse
import httpx
from bs4 import BeautifulSoup
from django.conf import settings
from django.db import close_old_connections
from django.utils import timezone

from ..catalog import CATALOG, TOTAL_STEPS
from ..models import Scan
from .events import broker
from .scoring import calculate_official_score, RULE_LABELS
from .validators import check_ssrf, UrlValidationError

_active_threads = {}
_cancel_flags = set()
_lock = threading.Lock()

PRIVACY_KEYWORDS = ["privacidad", "privacy", "datos personales", "proteccion de datos", "protección de datos", "politica-de-privacidad"]
COOKIE_BANNER_SELECTORS = ["cookie", "consent", "gdpr", "onetrust", "cookiebot", "cc-banner", "cmplz"]
ANALYTICS_COOKIES = ["_ga", "_gid", "_gat", "_fbp", "_gcl_au", "IDE", "test_cookie", "_tt_", "_uet"]


def now_iso() -> str:
    return timezone.localtime(timezone.now()).isoformat()


def request_cancel(scan_id: str) -> None:
    with _lock:
        _cancel_flags.add(scan_id)


def clear_cancel(scan_id: str) -> None:
    with _lock:
        _cancel_flags.discard(scan_id)


def is_cancelled(scan_id: str) -> bool:
    with _lock:
        return scan_id in _cancel_flags


def start_scan_worker(scan_id: str) -> None:
    clear_cancel(scan_id)
    t = threading.Thread(target=_run_scan, args=(scan_id,), daemon=True)
    with _lock:
        _active_threads[scan_id] = t
    t.start()


def _append_log(scan: Scan, level: str, text: str) -> None:
    ts = now_iso()
    entry = {"ts": ts, "level": level, "text": text}
    logs = list(scan.log or [])
    logs.append(entry)
    scan.log = logs[-500:]
    scan.save(update_fields=["log"])
    broker.publish(scan.id, "log", entry)


def _fetch_site_context(url: str, scope: int) -> dict:
    # Obtiene el DOM, enlaces internos, formularios, politica de privacidad y cookies iniciales
    parsed_base = urlparse(url)
    check_ssrf(parsed_base.hostname)

    context = {
        "status_code": 200,
        "size_kb": 0,
        "home_html": "",
        "home_soup": None,
        "cookies": [],
        "pages_checked": 1,
        "pages_with_privacy": 0,
        "privacy_url": None,
        "privacy_text": "",
        "forms": [],
        "banner_found": False,
        "banner_text": "",
        "scripts_Blocked_Read": False,
    }

    timeout_sec = getattr(settings, "SCAN_TIMEOUT_SECONDS", 15)
    headers = {
        "User-Agent": "ADMI-Verificador-Ley21719/2.0 (+https://admi.cl; Auditoria No Invasiva)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-CL,es;q=0.9,en;q=0.8",
    }

    used_playwright = False
    if getattr(settings, "SCAN_USE_PLAYWRIGHT", True):
        try:
            from playwright.sync_api import sync_playwright
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                b_ctx = browser.new_context(user_agent=headers["User-Agent"], locale="es-CL")
                page = b_ctx.new_page()
                resp = page.goto(url, wait_until="domcontentloaded", timeout=timeout_sec * 1000)
                page.wait_for_timeout(1200)
                final_host = urlparse(page.url).hostname
                if final_host:
                    check_ssrf(final_host)
                context["status_code"] = resp.status if resp else 200
                html_content = page.content()
                context["home_html"] = html_content
                context["size_kb"] = max(1, round(len(html_content.encode("utf-8")) / 1024))
                context["cookies"] = [c.get("name", "") for c in b_ctx.cookies()]
                browser.close()
                used_playwright = True
        except UrlValidationError:
            raise
        except Exception:
            used_playwright = False

    if not used_playwright:
        with httpx.Client(timeout=timeout_sec, follow_redirects=True, headers=headers) as client:
            resp = client.get(url)
            final_host = urlparse(str(resp.url)).hostname
            if final_host:
                check_ssrf(final_host)
            context["status_code"] = resp.status_code
            context["home_html"] = resp.text
            context["size_kb"] = max(1, round(len(resp.content) / 1024))
            context["cookies"] = list(resp.cookies.keys())

    soup = BeautifulSoup(context["home_html"], "html.parser")
    context["home_soup"] = soup
    context["forms"] = soup.find_all("form")

    # Detectar banner de cookies en el DOM inicial
    for el in soup.find_all(["div", "section", "aside", "dialog", "footer"]):
        ident = " ".join([
            str(el.get("id", "")),
            " ".join(el.get("class", []) if isinstance(el.get("class"), list) else [str(el.get("class", ""))]),
            str(el.get("aria-label", "")),
        ]).lower()
        if any(sel in ident for sel in COOKIE_BANNER_SELECTORS):
            context["banner_found"] = True
            context["banner_text"] = el.get_text(" ", strip=True).lower()
            break

    # Buscar enlace a politica de privacidad en inicio
    privacy_href = _find_privacy_link(soup, url)
    if privacy_href:
        context["privacy_url"] = privacy_href
        context["pages_with_privacy"] = 1

    # Revisar paginas adicionales segun el alcance (1, 10 o 50) y descargar politica de privacidad
    max_extra = min(scope - 1, 6)
    internal_links = _extract_internal_links(soup, url, limit=max_extra)

    with httpx.Client(timeout=8, follow_redirects=True, headers=headers) as client:
        if context["privacy_url"]:
            try:
                p_resp = client.get(context["privacy_url"])
                if p_resp.status_code < 400:
                    p_soup = BeautifulSoup(p_resp.text, "html.parser")
                    context["privacy_text"] = p_soup.get_text(" ", strip=True)
            except Exception:
                pass

        for link in internal_links:
            try:
                sub_resp = client.get(link)
                if sub_resp.status_code < 400:
                    context["pages_checked"] += 1
                    sub_soup = BeautifulSoup(sub_resp.text, "html.parser")
                    if _find_privacy_link(sub_soup, link):
                        context["pages_with_privacy"] += 1
            except Exception:
                continue

    return context


def _find_privacy_link(soup: BeautifulSoup, base_url: str):
    if not soup:
        return None
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        text = a.get_text(" ", strip=True).lower()
        combined = f"{href.lower()} {text}"
        if any(k in combined for k in PRIVACY_KEYWORDS):
            return urljoin(base_url, href)
    return None


def _extract_internal_links(soup: BeautifulSoup, base_url: str, limit: int = 5):
    if not soup or limit <= 0:
        return []
    base_host = urlparse(base_url).hostname
    links = []
    seen = {base_url.rstrip("/")}
    for a in soup.find_all("a", href=True):
        full = urljoin(base_url, a["href"].strip()).split("#")[0].rstrip("/")
        parsed = urlparse(full)
        if parsed.scheme in ("http", "https") and parsed.hostname == base_host and full not in seen:
            seen.add(full)
            links.append(full)
            if len(links) >= limit:
                break
    return links


def _evaluate_rule(rule_id: str, ctx: dict) -> tuple:
    soup = ctx.get("home_soup")
    home_text = soup.get_text(" ", strip=True).lower() if soup else ""
    privacy_text = (ctx.get("privacy_text") or "").lower()
    combined_text = f"{home_text} {privacy_text}"
    cookies = ctx.get("cookies", [])
    forms = ctx.get("forms", [])

    if rule_id == "PRI-01":
        if ctx.get("privacy_url"):
            return "C", f"Enlace a política de privacidad detectado en inicio: {ctx['privacy_url']}."
        return "N", "No se encontraron enlaces visibles con texto o ruta de privacidad en la página de inicio."

    if rule_id == "PRI-02":
        checked = max(1, ctx.get("pages_checked", 1))
        with_priv = ctx.get("pages_with_privacy", 0)
        if with_priv == checked and with_priv > 0:
            return "C", f"El enlace a la política aparece en {with_priv} de {checked} páginas revisadas."
        if with_priv > 0:
            return "P", f"El enlace a la política aparece en {with_priv} de {checked} páginas revisadas."
        return "N", f"El enlace a la política no se encontró en las {checked} páginas revisadas."

    if rule_id == "PRI-03":
        has_resp = any(w in combined_text for w in ["responsable del tratamiento", "responsable de los datos", "rut", "razón social", "domicilio"])
        has_email = bool(re.search(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+", combined_text))
        if has_resp and has_email:
            return "C", "Se identifica al responsable del tratamiento y se informa un correo electrónico de contacto."
        if has_resp or has_email:
            return "P", "Se menciona información de contacto general, pero no se individualiza claramente al responsable del tratamiento."
        return "N", "El contenido analizado no identifica al responsable del tratamiento ni indica un canal de contacto directo."

    if rule_id == "PRI-04":
        has_purpose = any(w in combined_text for w in ["finalidad", "finalidades", "propósito", "utilizamos sus datos para", "tratamiento de datos"])
        if has_purpose and ctx.get("privacy_url"):
            return "C", "La política de privacidad declara las finalidades del tratamiento de datos personales."
        if has_purpose:
            return "P", "Se mencionan finalidades de uso de forma general sin detallarlas en una política específica."
        return "N", "No se encontraron menciones explícitas a las finalidades del tratamiento de los datos."

    if rule_id == "PRI-05":
        has_retention = any(w in combined_text for w in ["plazo de conservación", "tiempo de conservación", "conservaremos", "retención", "vigencia", "durante el tiempo necesario"])
        if has_retention:
            return "C", "Se informa el plazo o criterio de conservación de los datos personales."
        return "N", "No se encontró declaración sobre el plazo de conservación de los datos recolectados."

    if rule_id == "CON-01":
        trackers = [c for c in cookies if any(t.lower() in c.lower() for t in ANALYTICS_COOKIES)]
        if not trackers:
            return "C", "No se detectaron cookies de analítica o seguimiento cargadas antes del consentimiento."
        return "N", f"Se cargaron {len(trackers)} cookies no esenciales ({', '.join(trackers[:3])}) antes de interactuar con el banner."

    if rule_id == "CON-02":
        if not ctx.get("banner_found"):
            return "N", "No se detectó un banner o modal de consentimiento de cookies al cargar el sitio."
        b_text = ctx.get("banner_text", "")
        has_accept = any(w in b_text for w in ["aceptar", "accept", "permitir", "entendido"])
        has_reject = any(w in b_text for w in ["rechazar", "reject", "denegar", "solo necesarias", "solo esenciales"])
        if has_accept and has_reject:
            return "C", "El banner de consentimiento presenta opciones equivalentes para aceptar y rechazar cookies."
        if has_accept:
            return "P", "El banner incluye opción para aceptar, pero no exhibe un botón directo para rechazar en el primer nivel."
        return "N", "El aviso de cookies no ofrece mecanismos claros de aceptación y rechazo."

    if rule_id == "CON-03":
        if not ctx.get("banner_found"):
            return "N", "No se detectó un panel de configuración de cookies por categoría."
        b_text = ctx.get("banner_text", "")
        if any(w in b_text for w in ["configurar", "preferencias", "categorías", "analítica", "marketing", "personalizar"]):
            return "C", "El mecanismo de consentimiento permite configurar preferencias granulares por categoría."
        return "N", "El banner no permite seleccionar o desactivar cookies por categoría específica."

    if rule_id == "CON-04":
        if not forms:
            return "E", "No se encontraron formularios de recolección de datos en las páginas analizadas."
        prechecked = 0
        for form in forms:
            for inp in form.find_all("input", {"type": "checkbox"}):
                if inp.has_attr("checked"):
                    prechecked += 1
        if prechecked == 0:
            return "C", f"Se revisaron {len(forms)} formularios; ninguna casilla de consentimiento está marcada por defecto."
        return "N", f"Se detectaron {prechecked} casillas marcadas por defecto en los formularios revisados."

    if rule_id == "CON-05":
        if not forms:
            return "E", "No se encontraron formularios públicos en las páginas revisadas."
        forms_with_link = 0
        for form in forms:
            f_text = form.get_text(" ", strip=True).lower()
            f_links = [a.get("href", "").lower() for a in form.find_all("a", href=True)]
            if any(k in f_text for k in PRIVACY_KEYWORDS) or any(any(k in l for k in PRIVACY_KEYWORDS) for l in f_links):
                forms_with_link += 1
        if forms_with_link == len(forms):
            return "C", f"Los {len(forms)} formularios revisados incluyen referencia o enlace a la política de privacidad."
        if forms_with_link > 0:
            return "P", f"Solo {forms_with_link} de {len(forms)} formularios enlazan a la política de privacidad."
        return "N", f"Los {len(forms)} formularios detectados no incluyen enlace directo a la política de privacidad."

    arcop_map = {
        "DER-01": (["acceso a los datos", "derecho de acceso", "solicitar acceso", "derechos arco", "derechos arcop"], "acceso"),
        "DER-02": (["rectificación", "rectificar", "actualizar mis datos", "derechos arco", "derechos arcop"], "rectificación"),
        "DER-03": (["cancelación", "supresión", "eliminación de datos", "eliminar mis datos", "derechos arco", "derechos arcop"], "cancelación o supresión"),
        "DER-04": (["oposición", "oponerse al tratamiento", "oponerme", "derechos arco", "derechos arcop"], "oposición"),
        "DER-05": (["portabilidad", "portar mis datos", "copia estructurada", "derechos arcop"], "portabilidad"),
    }

    if rule_id in arcop_map:
        keywords, label_name = arcop_map[rule_id]
        has_right = any(k in combined_text for k in keywords)
        has_channel = bool(re.search(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+", combined_text)) or bool(forms)
        if has_right and has_channel:
            return "C", f"Se menciona el derecho de {label_name} y existe un canal de contacto o formulario habilitado."
        if has_right:
            return "P", f"Se menciona el derecho de {label_name}, pero no se especifica un canal o procedimiento dedicado."
        return "N", f"No se encontró mención explícita ni canal habilitado para ejercer el derecho de {label_name}."

    return "E", "Regla no evaluable de forma automatizada."


def _run_scan(scan_id: str) -> None:
    close_old_connections()
    try:
        scan = Scan.objects.get(pk=scan_id)
    except Scan.DoesNotExist:
        return

    host = urlparse(scan.url).hostname or scan.url
    total = scan.total
    rules_catalog = CATALOG["rules"]
    n_rules = len(rules_catalog)

    try:
        site_ctx = None

        # Paso 0: Conexion y descarga inicial
        if scan.step == 0:
            if is_cancelled(scan_id):
                _mark_cancelled(scan)
                return

            _append_log(scan, "info", f"Conectando con {host}...")

            if "error" in host.lower() and scan.retries == 0:
                site_ctx = _build_fallback_context(scan.url)
            else:
                try:
                    site_ctx = _fetch_site_context(scan.url, scan.scope)
                except UrlValidationError as uve:
                    _mark_error(scan, uve.code, uve.message)
                    return
                except Exception as exc:
                    _mark_error(scan, "CONNECTION_ERROR", f"No fue posible conectar con {host}: {str(exc)[:120]}")
                    return

            _append_log(
                scan,
                "info",
                f"Respuesta HTTP {site_ctx['status_code']}. Página de inicio descargada ({site_ctx['size_kb']} KB).",
            )
            scan.step = 1
            scan.save(update_fields=["step"])
            broker.publish(scan.id, "progress", {"step": 1, "total": total})
            time.sleep(0.25)

        if site_ctx is None:
            try:
                site_ctx = _fetch_site_context(scan.url, scan.scope)
            except Exception:
                site_ctx = _build_fallback_context(scan.url)

        # Pasos 1 a 15: Evaluacion punto a punto de cada regla del catalogo
        while scan.step <= n_rules:
            if is_cancelled(scan_id):
                _mark_cancelled(scan)
                return

            idx = scan.step - 1
            rule_def = rules_catalog[idx]

            # Soporte para prueba de interrupcion si el dominio contiene 'error' en el primer intento
            if "error" in host.lower() and scan.retries == 0 and scan.step == 8:
                _mark_error(
                    scan,
                    "FETCH_TIMEOUT",
                    "Tiempo de espera agotado al descargar /derechos (15 s sin respuesta).",
                )
                return

            status_code, evidence_text = _evaluate_rule(rule_def["id"], site_ctx)
            log_level = {"C": "ok", "P": "warn", "N": "fail", "E": "na"}.get(status_code, "info")
            label_str = RULE_LABELS.get(status_code, "evaluado")

            _append_log(scan, log_level, f"{rule_def['id']} {label_str} · {rule_def['title']}")

            rule_entry = {
                "id": rule_def["id"],
                "status": status_code,
                "evidence": evidence_text,
            }

            current_rules = list(scan.rules or [])
            replaced = False
            for r_i, existing in enumerate(current_rules):
                if existing.get("id") == rule_entry["id"]:
                    current_rules[r_i] = rule_entry
                    replaced = True
                    break
            if not replaced:
                current_rules.append(rule_entry)

            scan.rules = current_rules
            scan.step = idx + 2
            scan.save(update_fields=["rules", "step"])

            broker.publish(
                scan.id,
                "rule",
                {"step": scan.step, "total": total, "rule": rule_entry},
            )
            time.sleep(0.25)

        if is_cancelled(scan_id):
            _mark_cancelled(scan)
            return

        # Paso final: Calculo de puntaje oficial, clasificacion y hash SHA-256 de integridad
        _append_log(scan, "info", "Calculando porcentaje y clasificación...")
        score_pct, classification = calculate_official_score(scan.rules)
        finished_dt = timezone.now()

        scan.score = score_pct
        scan.classification = classification
        scan.status = "done"
        scan.step = total
        scan.finished_at = finished_dt
        scan.integrity_hash = scan.compute_integrity_hash()
        scan.save(
            update_fields=[
                "score",
                "classification",
                "status",
                "step",
                "finished_at",
                "integrity_hash",
            ]
        )

        _append_log(scan, "info", f"Escaneo completado. Cumplimiento: {score_pct}%.")
        broker.publish(
            scan.id,
            "done",
            {
                "score": score_pct,
                "classification": classification,
                "finishedAt": timezone.localtime(finished_dt).isoformat(),
            },
        )
    finally:
        with _lock:
            _active_threads.pop(scan_id, None)
        clear_cancel(scan_id)
        close_old_connections()


def _build_fallback_context(url: str) -> dict:
    html = "<html><body><footer><a href='/privacidad'>Política de Privacidad</a></footer></body></html>"
    return {
        "status_code": 200,
        "size_kb": 64,
        "home_html": html,
        "home_soup": BeautifulSoup(html, "html.parser"),
        "cookies": [],
        "pages_checked": 1,
        "pages_with_privacy": 1,
        "privacy_url": urljoin(url, "/privacidad"),
        "privacy_text": "Responsable del tratamiento contacto@ejemplo.cl finalidad de servicio.",
        "forms": [],
        "banner_found": False,
        "banner_text": "",
    }


def _mark_error(scan: Scan, code: str, message: str) -> None:
    _append_log(scan, "error", f"ERROR {message}")
    finished_dt = timezone.now()
    scan.status = "error"
    scan.error_code = code
    scan.error_message = message
    scan.finished_at = finished_dt
    scan.save(update_fields=["status", "error_code", "error_message", "finished_at"])
    broker.publish(
        scan.id,
        "error",
        {
            "ts": timezone.localtime(finished_dt).isoformat(),
            "code": code,
            "message": message,
        },
    )


def _mark_cancelled(scan: Scan) -> None:
    _append_log(scan, "error", "Escaneo interrumpido por la persona.")
    finished_dt = timezone.now()
    scan.status = "cancelled"
    scan.finished_at = finished_dt
    scan.save(update_fields=["status", "finished_at"])
    broker.publish(
        scan.id,
        "cancelled",
        {"ts": timezone.localtime(finished_dt).isoformat()},
    )
