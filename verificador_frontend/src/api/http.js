import { API_URL } from '../config.js';

export class ApiError extends Error {
  constructor(message, { status, code } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

function filenameFrom(res, fallback) {
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(res.headers.get('Content-Disposition') || '');
  return match ? decodeURIComponent(match[1]) : fallback;
}

/** fetch con timeout, errores en español y sin credenciales (no se envían cookies). */
export async function http(path, { method = 'GET', body, timeout = 15000, responseType = 'json', fallbackName = 'informe' } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      credentials: 'omit',
      signal: controller.signal,
      headers: { Accept: responseType === 'json' ? 'application/json' : '*/*', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new ApiError(
      err?.name === 'AbortError'
        ? 'El servidor tardó demasiado en responder. Inténtalo nuevamente.'
        : 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.',
      { code: 'NETWORK' },
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    let message = `El servidor respondió con un error (${res.status}).`;
    let code;
    try {
      const data = await res.json();
      message = data.message || message;
      code = data.code;
    } catch {
      /* respuesta sin JSON */
    }
    throw new ApiError(message, { status: res.status, code });
  }

  if (responseType === 'blob') return { blob: await res.blob(), filename: filenameFrom(res, fallbackName) };
  return res.status === 204 ? null : res.json();
}
