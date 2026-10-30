# Integración Front End ⇄ Back End

Este documento es para quien construye el backend. El front end ya implementa todo lo de aquí en
`src/api/realApi.js`; con `VITE_USE_MOCK=false` deja de usar el simulador y llama al servidor.

- Base: `/api` (cambiable con `VITE_API_URL`). JSON en UTF-8. Fechas ISO 8601 con zona horaria.
- Sin cookies ni sesión: el front hace `credentials: 'omit'`. No se necesita login.
- Errores: cualquier código `>= 400` con `{ "message": "Texto en español para mostrar", "code": "OPCIONAL" }`.
  El front muestra `message` tal cual a la persona.
- Si el front y el backend están en dominios distintos, habilitar CORS (incluido `EventSource`).
- En desarrollo no hace falta CORS: Vite reenvía `/api` a `VITE_API_PROXY` (por defecto `http://localhost:8000`).

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/rules` | Catálogo: `{ categories: [{id,label}], rules: [{id,category,title,fix,legalRef}] }`. Se pide una vez al abrir la app. |
| POST | `/scans` | Body `{ url, scope }` (`scope` = 1, 10 o 50 páginas). Responde `201` con la **Verificación** en estado `running`. |
| GET | `/scans/{id}` | **Verificación** completa. `404` si no existe. |
| GET | `/scans/{id}/events` | Tiempo real por **Server-Sent Events** (ver abajo). |
| POST | `/scans/{id}/cancel` | Cancela. `409` si ya terminó. |
| POST | `/scans/{id}/retry` | Reanuda desde el último paso (solo `error` o `cancelled`; `409` en otro caso). Aumenta `retries`. |
| DELETE | `/scans/{id}` | Elimina el registro y su informe. `204`. |
| GET | `/scans?q=&status=&page=&pageSize=` | Historial, más recientes primero. Responde `{ items, total, page, pageSize }`. Los `items` pueden omitir `rules` y `log`. |
| GET | `/scans/{id}/report?format=pdf\|csv\|json` | Descarga del informe. Usar `Content-Disposition: attachment; filename="..."`. Solo `done`. |

## Objeto Verificación

```json
{
  "id": "VER-20261028-0143",
  "url": "https://www.sitio.cl",
  "scope": 10,
  "status": "running | done | error | cancelled",
  "startedAt": "2026-10-28T14:05:12-03:00",
  "finishedAt": null,
  "step": 7,
  "total": 17,
  "retries": 0,
  "score": null,
  "classification": null,
  "rules": [ { "id": "CON-01", "status": "N", "evidence": "Se cargaron 3 cookies de analítica antes del banner." } ],
  "log": [ { "ts": "2026-10-28T14:05:14-03:00", "level": "info", "text": "Conectando…" } ],
  "errorMessage": null,
  "errorCode": null
}
```

- `step`/`total`: el porcentaje de avance es `step / total`. Un paso es "conexión", uno por regla y uno de "cálculo final" (en el ejemplo, 15 reglas + 2 = 17).
- `rules[].status`: `C` cumple (1 punto), `P` parcial (0,5), `N` no cumple (0), `E` no evaluable (no entra al puntaje).
- `score`: entero 0–100, solo cuando `status = done`. `classification`: `bajo` (<50), `parcial` (50–84) o `alto` (≥85). **El puntaje oficial lo calcula el backend**; el front recalcula solo para el desglose por categoría.
- `log[].level`: `info`, `ok`, `warn`, `fail`, `na` o `error` (define el color en pantalla).
- `evidence` debe ser texto plano (el front lo muestra escapado, nunca como HTML).

## Eventos en tiempo real (SSE)

`GET /scans/{id}/events` con `Content-Type: text/event-stream`. Cada mensaje usa el **nombre de evento** indicado y un JSON en `data`:

| event | data |
|---|---|
| `progress` | `{ "step": 1, "total": 17 }` |
| `rule` | `{ "step": 7, "total": 17, "rule": { "id": "CON-01", "status": "N", "evidence": "..." } }` |
| `log` | `{ "ts": "ISO", "level": "info", "text": "..." }` |
| `error` | `{ "ts": "ISO", "code": "FETCH_TIMEOUT", "message": "Tiempo de espera agotado..." }` |
| `cancelled` | `{ "ts": "ISO" }` |
| `retry` | `{ "retries": 1 }` |
| `done` | `{ "score": 54, "classification": "parcial", "finishedAt": "ISO" }` |

Reglas para que funcione bien:

1. **Cerrar el flujo** después de `done`, `error` o `cancelled`. El front también cierra su lado al recibirlos.
2. Si se abre `/events` de un escaneo que ya terminó, emitir su evento final y cerrar (no dejarlo colgado).
3. El front se suscribe **antes** de pedir `GET /scans/{id}` y luego aplica los eventos sobre esa foto. Es seguro repetir eventos: se ignoran los duplicados (por `rule.id` y por `ts`+`text` en el log). No hace falta numerarlos.
4. Si `/events` no existe o se corta, el front pasa solo a consultar `GET /scans/{id}` cada 2 s, así que `GET /scans/{id}` siempre debe reflejar el estado actual.

## Validación en el servidor (obligatoria)

El front solo hace una validación de cortesía de la URL. El backend debe volver a validar: solo `http`/`https`, rechazar direcciones locales o de redes internas (SSRF, incluido tras redirecciones), límite de tamaño y tiempo de descarga, y no enviar formularios ni iniciar sesión en los sitios analizados.
