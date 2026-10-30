const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.0\.0\.0|\[?::1\]?$)/i;

/**
 * Valida y normaliza la dirección escrita por la persona.
 * Es una validación de cortesía: el backend debe validar de nuevo (SSRF, redes internas, etc.).
 * @returns {{url:string}|{error:string}}
 */
export function normalizeUrl(input) {
  const raw = (input ?? '').trim();
  if (!raw) return { error: 'Escribe la dirección del sitio que quieres verificar.' };
  if (/\s/.test(raw)) return { error: 'La dirección no puede contener espacios.' };

  const value = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  let u;
  try {
    u = new URL(value);
  } catch {
    return { error: 'Esa dirección no parece válida. Revisa que tenga un dominio, por ejemplo www.ejemplo.cl.' };
  }
  if (!u.hostname.includes('.')) {
    return { error: 'Esa dirección no parece válida. Revisa que tenga un dominio, por ejemplo www.ejemplo.cl.' };
  }
  if (PRIVATE_HOST.test(u.hostname)) {
    return { error: 'Ingresa una dirección pública. No se permiten direcciones locales ni de redes internas.' };
  }
  if (u.username || u.password) {
    return { error: 'La dirección no debe incluir usuario ni contraseña.' };
  }
  return { url: u.origin + (u.pathname === '/' ? '' : u.pathname) };
}
