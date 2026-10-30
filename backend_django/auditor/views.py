import json
import queue
from urllib.parse import urlparse
from django.http import JsonResponse, HttpResponse, StreamingHttpResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .catalog import CATALOG, TOTAL_STEPS
from .models import Scan
from .services.events import broker, format_sse
from .services.exporters import (
    generate_csv_report,
    generate_json_report,
    generate_pdf_report,
    get_report_filename,
)
from .services.scanner import start_scan_worker, request_cancel, now_iso
from .services.validators import validate_and_normalize_url, UrlValidationError


def api_error(message: str, status: int = 400, code: str = None) -> JsonResponse:
    payload = {"message": message}
    if code:
        payload["code"] = code
    return JsonResponse(payload, status=status, json_dumps_params={"ensure_ascii": False})


def _next_scan_id() -> str:
    now_local = timezone.localtime(timezone.now())
    day_prefix = now_local.strftime("%Y%m%d")
    existing = Scan.objects.filter(id__startswith="VER-").values_list("id", flat=True)
    max_seq = 142
    for s_id in existing:
        parts = s_id.split("-")
        if len(parts) == 3 and parts[2].isdigit():
            max_seq = max(max_seq, int(parts[2]))
    return f"VER-{day_prefix}-{max_seq + 1:04d}"


@require_http_methods(["GET"])
def rules_catalog_view(request):
    return JsonResponse(CATALOG, json_dumps_params={"ensure_ascii": False})


@csrf_exempt
@require_http_methods(["GET", "POST"])
def scans_collection_view(request):
    if request.method == "GET":
        q = (request.GET.get("q") or "").strip().lower()
        status_filter = (request.GET.get("status") or "").strip()
        try:
            page = max(1, int(request.GET.get("page") or 1))
        except ValueError:
            page = 1
        try:
            page_size = max(1, min(100, int(request.GET.get("pageSize") or 10)))
        except ValueError:
            page_size = 10

        queryset = Scan.objects.all()
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if q:
            queryset = queryset.filter(url__icontains=q)

        total = queryset.count()
        start = (page - 1) * page_size
        items = [scan.to_dict(summary=True) for scan in queryset[start : start + page_size]]

        return JsonResponse(
            {
                "items": items,
                "total": total,
                "page": page,
                "pageSize": page_size,
            },
            json_dumps_params={"ensure_ascii": False},
        )

    # POST /api/scans
    try:
        body = json.loads(request.body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        return api_error("El cuerpo de la solicitud no es un JSON válido.", status=400, code="INVALID_JSON")

    raw_url = body.get("url", "")
    scope = body.get("scope", 10)
    try:
        scope = int(scope)
    except (TypeError, ValueError):
        return api_error("El alcance seleccionado no es válido.", status=400, code="INVALID_SCOPE")

    if scope not in (1, 10, 50):
        return api_error("El alcance debe ser 1, 10 o 50 páginas.", status=400, code="INVALID_SCOPE")

    try:
        normalized_url = validate_and_normalize_url(raw_url)
    except UrlValidationError as exc:
        return api_error(exc.message, status=400, code=exc.code)

    scan_id = _next_scan_id()
    host = urlparse(normalized_url).hostname or normalized_url
    initial_log = [
        {
            "ts": now_iso(),
            "level": "info",
            "text": f"Verificación iniciada para {host}.",
        }
    ]

    scan = Scan.objects.create(
        id=scan_id,
        url=normalized_url,
        scope=scope,
        status="running",
        step=0,
        total=TOTAL_STEPS,
        retries=0,
        rules=[],
        log=initial_log,
    )

    start_scan_worker(scan.id)
    return JsonResponse(scan.to_dict(summary=False), status=201, json_dumps_params={"ensure_ascii": False})


@csrf_exempt
@require_http_methods(["GET", "DELETE"])
def scan_detail_view(request, scan_id: str):
    try:
        scan = Scan.objects.get(pk=scan_id)
    except Scan.DoesNotExist:
        return api_error("No se encontró la verificación solicitada.", status=404, code="NOT_FOUND")

    if request.method == "DELETE":
        if scan.status == "running":
            request_cancel(scan.id)
        scan.delete()
        return HttpResponse(status=204)

    return JsonResponse(scan.to_dict(summary=False), json_dumps_params={"ensure_ascii": False})


@csrf_exempt
@require_http_methods(["POST"])
def scan_cancel_view(request, scan_id: str):
    try:
        scan = Scan.objects.get(pk=scan_id)
    except Scan.DoesNotExist:
        return api_error("No se encontró la verificación solicitada.", status=404, code="NOT_FOUND")

    if scan.status != "running":
        return api_error("La verificación ya terminó.", status=409, code="ALREADY_FINISHED")

    request_cancel(scan.id)
    finished_dt = timezone.now()
    ts_str = timezone.localtime(finished_dt).isoformat()
    logs = list(scan.log or [])
    logs.append({"ts": ts_str, "level": "error", "text": "Escaneo interrumpido por la persona."})

    scan.status = "cancelled"
    scan.finished_at = finished_dt
    scan.log = logs[-500:]
    scan.save(update_fields=["status", "finished_at", "log"])

    broker.publish(scan.id, "log", logs[-1])
    broker.publish(scan.id, "cancelled", {"ts": ts_str})
    return JsonResponse(scan.to_dict(summary=False), json_dumps_params={"ensure_ascii": False})


@csrf_exempt
@require_http_methods(["POST"])
def scan_retry_view(request, scan_id: str):
    try:
        scan = Scan.objects.get(pk=scan_id)
    except Scan.DoesNotExist:
        return api_error("No se encontró la verificación solicitada.", status=404, code="NOT_FOUND")

    if scan.status not in ("error", "cancelled"):
        return api_error(
            "Solo se pueden reintentar verificaciones con error o interrumpidas.",
            status=409,
            code="INVALID_STATE",
        )

    scan.retries += 1
    scan.status = "running"
    scan.error_message = None
    scan.error_code = None
    scan.finished_at = None

    retry_log = {
        "ts": now_iso(),
        "level": "info",
        "text": f"Reintento n.º {scan.retries}. Continúa desde el paso {scan.step + 1}.",
    }
    logs = list(scan.log or [])
    logs.append(retry_log)
    scan.log = logs[-500:]
    scan.save(update_fields=["retries", "status", "error_message", "error_code", "finished_at", "log"])

    broker.publish(scan.id, "retry", {"retries": scan.retries})
    broker.publish(scan.id, "log", retry_log)

    start_scan_worker(scan.id)
    return JsonResponse(scan.to_dict(summary=False), json_dumps_params={"ensure_ascii": False})


@require_http_methods(["GET"])
def scan_events_view(request, scan_id: str):
    try:
        scan = Scan.objects.get(pk=scan_id)
    except Scan.DoesNotExist:
        return api_error("No se encontró la verificación solicitada.", status=404, code="NOT_FOUND")

    def event_stream():
        # Si el escaneo ya termino al abrir la conexion SSE, emitir su evento final y cerrar
        current = Scan.objects.filter(pk=scan_id).first()
        if not current:
            return

        if current.status == "done":
            yield format_sse(
                "done",
                {
                    "score": current.score,
                    "classification": current.classification,
                    "finishedAt": timezone.localtime(current.finished_at).isoformat() if current.finished_at else now_iso(),
                },
            )
            return
        elif current.status == "error":
            yield format_sse(
                "error",
                {
                    "ts": timezone.localtime(current.finished_at).isoformat() if current.finished_at else now_iso(),
                    "code": current.error_code or "SCAN_ERROR",
                    "message": current.error_message or "Error durante la verificación.",
                },
            )
            return
        elif current.status == "cancelled":
            yield format_sse(
                "cancelled",
                {
                    "ts": timezone.localtime(current.finished_at).isoformat() if current.finished_at else now_iso(),
                },
            )
            return

        q = broker.subscribe(scan_id)
        try:
            while True:
                try:
                    ev_type, ev_data = q.get(timeout=15)
                    yield format_sse(ev_type, ev_data)
                    if ev_type in ("done", "error", "cancelled"):
                        break
                except queue.Empty:
                    refreshed = Scan.objects.filter(pk=scan_id).first()
                    if not refreshed or refreshed.status != "running":
                        if refreshed and refreshed.status == "done":
                            yield format_sse(
                                "done",
                                {
                                    "score": refreshed.score,
                                    "classification": refreshed.classification,
                                    "finishedAt": timezone.localtime(refreshed.finished_at).isoformat()
                                    if refreshed.finished_at
                                    else now_iso(),
                                },
                            )
                        break
                    yield ": keep-alive\n\n"
        finally:
            broker.unsubscribe(scan_id, q)

    response = StreamingHttpResponse(event_stream(), content_type="text/event-stream; charset=utf-8")
    response["Cache-Control"] = "no-cache"
    response["X-Accel-Buffering"] = "no"
    return response


@require_http_methods(["GET"])
def scan_report_view(request, scan_id: str):
    try:
        scan = Scan.objects.get(pk=scan_id)
    except Scan.DoesNotExist:
        return api_error("No se encontró la verificación solicitada.", status=404, code="NOT_FOUND")

    if scan.status != "done":
        return api_error(
            "Solo las verificaciones completadas permiten exportar el informe.",
            status=409,
            code="REPORT_NOT_READY",
        )

    fmt = (request.GET.get("format") or "pdf").strip().lower()
    if fmt not in ("pdf", "csv", "json"):
        return api_error("Formato de exportación no soportado. Use pdf, csv o json.", status=400, code="INVALID_FORMAT")

    filename = get_report_filename(scan, fmt)

    if fmt == "csv":
        content = generate_csv_report(scan)
        content_type = "text/csv; charset=utf-8"
    elif fmt == "json":
        content = generate_json_report(scan)
        content_type = "application/json; charset=utf-8"
    else:
        content = generate_pdf_report(scan)
        content_type = "application/pdf"

    response = HttpResponse(content, content_type=content_type)
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response
