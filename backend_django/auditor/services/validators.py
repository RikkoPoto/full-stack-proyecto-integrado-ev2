import ipaddress
import socket
from urllib.parse import urlparse


class UrlValidationError(Exception):
    def __init__(self, message: str, code: str = "INVALID_URL"):
        super().__init__(message)
        self.message = message
        self.code = code


def validate_and_normalize_url(raw_url: str) -> str:
    raw = (raw_url or "").strip()
    if not raw:
        raise UrlValidationError("Escribe la dirección del sitio que quieres verificar.")
    if any(c.isspace() for c in raw):
        raise UrlValidationError("La dirección no puede contener espacios.")

    if not raw.lower().startswith(("http://", "https://")):
        raw = f"https://{raw}"

    parsed = urlparse(raw)
    if parsed.scheme not in ("http", "https"):
        raise UrlValidationError("Solo se permiten direcciones con protocolo HTTP o HTTPS.")
    if not parsed.hostname or "." not in parsed.hostname:
        raise UrlValidationError("Esa dirección no parece válida. Revisa que tenga un dominio, por ejemplo www.ejemplo.cl.")
    if parsed.username or parsed.password:
        raise UrlValidationError("La dirección no debe incluir usuario ni contraseña.")

    check_ssrf(parsed.hostname)

    path = "" if parsed.path in ("", "/") else parsed.path
    return f"{parsed.scheme}://{parsed.netloc}{path}"


def check_ssrf(hostname: str) -> None:
    lower_host = hostname.lower()
    if lower_host in ("localhost", "localhost.localdomain"):
        raise UrlValidationError(
            "Ingresa una dirección pública. No se permiten direcciones locales ni de redes internas.",
            code="SSRF_BLOCKED",
        )

    try:
        ip_obj = ipaddress.ip_address(lower_host.strip("[]"))
        if _is_restricted_ip(ip_obj):
            raise UrlValidationError(
                "Ingresa una dirección pública. No se permiten direcciones locales ni de redes internas.",
                code="SSRF_BLOCKED",
            )
        return
    except ValueError:
        pass

    try:
        addr_info = socket.getaddrinfo(hostname, None)
        for item in addr_info:
            ip_str = item[4][0]
            ip_obj = ipaddress.ip_address(ip_str)
            if _is_restricted_ip(ip_obj):
                raise UrlValidationError(
                    "El dominio resuelve a una dirección de red interna no permitida.",
                    code="SSRF_BLOCKED",
                )
    except socket.gaierror:
        # Si el DNS no resuelve al validar, fallara controladamente en la etapa de conexion del escaneo
        pass


def _is_restricted_ip(ip_obj) -> bool:
    return (
        ip_obj.is_private
        or ip_obj.is_loopback
        or ip_obj.is_link_local
        or ip_obj.is_multicast
        or ip_obj.is_reserved
        or ip_obj.is_unspecified
    )
