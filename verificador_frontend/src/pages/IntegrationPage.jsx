import { API_URL, USE_MOCK } from '../config.js';
import { useDocumentTitle } from '../hooks/useMisc.js';

const ENDPOINTS = [
  ['GET', '/api/rules', 'Catálogo de reglas y categorías (con referencia normativa).'],
  ['POST', '/api/scans', 'Inicio. Recibe url y scope, devuelve la verificación con su id.'],
  ['GET', '/api/scans/{id}', 'Foto completa: reglas evaluadas, puntaje y clasificación.'],
  ['GET', '/api/scans/{id}/events', 'Escaneo en vivo. Flujo SSE con avance, reglas, registro y errores.'],
  ['POST', '/api/scans/{id}/cancel', 'Escaneo en vivo. Botón Cancelar.'],
  ['POST', '/api/scans/{id}/retry', 'Escaneo en vivo e Historial. Reanuda desde el último paso.'],
  ['DELETE', '/api/scans/{id}', 'Historial. Eliminar una verificación.'],
  ['GET', '/api/scans?status=&q=&page=&pageSize=', 'Historial. Devuelve { items, total, page, pageSize }.'],
  ['GET', '/api/scans/{id}/report?format=pdf|json|csv', 'Informe. Botones de exportación (descarga).'],
];

const EVENT = `event: rule
data: {
  "step": 7,
  "total": 17,
  "rule": {
    "id": "CON-01",
    "status": "N",
    "evidence": "Se cargaron 3 cookies de analítica antes del banner."
  }
}`;

const RESULT = `{
  "id": "VER-20261028-0143",
  "url": "https://www.sitio.cl",
  "scope": 10,
  "startedAt": "2026-10-28T14:05:12-03:00",
  "finishedAt": "2026-10-28T14:07:30-03:00",
  "status": "done",
  "step": 17, "total": 17, "retries": 0,
  "score": 54,
  "classification": "parcial",
  "rules": [
    { "id": "PRI-01", "status": "C", "evidence": "..." }
  ],
  "log": [ { "ts": "...", "level": "info", "text": "..." } ],
  "errorMessage": null
}`;

const STATES = [
  ['chip-C', 'C', 'Cumple. Suma 1 punto.'],
  ['chip-P', 'P', 'Parcial. Suma 0,5 puntos.'],
  ['chip-N', 'N', 'No cumple. Suma 0 puntos.'],
  ['chip-E', 'E', 'No evaluable. No entra en el puntaje.'],
];

export default function IntegrationPage() {
  useDocumentTitle('Integración');
  return (
    <div>
      <p className="eyebrow">Para el equipo de backend</p>
      <h1 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">Qué espera el front end</h1>
      <p className="mt-2 max-w-2xl text-sm text-mute">
        El front end ya implementa estas rutas en <span className="font-mono">src/api/realApi.js</span>. Con <span className="font-mono">VITE_USE_MOCK=false</span> deja de usar el simulador y llama al backend. El detalle completo está en <span className="font-mono">docs/INTEGRACION_API.md</span>.
      </p>

      <div className="panel mt-6 flex flex-wrap gap-x-8 gap-y-2 p-4 text-sm">
        <p><span className="text-mute">Modo actual: </span><span className="font-semibold">{USE_MOCK ? 'Simulación (sin backend)' : 'Backend real'}</span></p>
        <p><span className="text-mute">URL base de la API: </span><span className="font-mono">{API_URL}</span></p>
      </div>

      <div className="panel mt-6 overflow-x-auto">
        <table className="w-full min-w-[44rem] text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wider text-mute">
              <th scope="col" className="px-4 py-3 font-medium">Método</th>
              <th scope="col" className="px-4 py-3 font-medium">Ruta</th>
              <th scope="col" className="px-4 py-3 font-medium">Para qué se usa</th>
            </tr>
          </thead>
          <tbody>
            {ENDPOINTS.map(([m, path, use]) => (
              <tr key={m + path} className="border-t border-line">
                <td className="px-4 py-3 font-mono text-xs font-semibold">{m}</td>
                <td className="px-4 py-3 font-mono text-xs">{path}</td>
                <td className="px-4 py-3">{use}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Evento SSE de regla evaluada</h2>
          <p className="mt-1 text-xs text-mute">Tipos de evento: progress, rule, log, error, cancelled, retry, done.</p>
          <pre className="panel mt-2 overflow-x-auto p-4 font-mono text-xs leading-5">{EVENT}</pre>
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Objeto de verificación</h2>
          <pre className="panel mt-2 overflow-x-auto p-4 font-mono text-xs leading-5">{RESULT}</pre>
        </div>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <section className="panel p-5">
          <h2 className="text-sm font-semibold">Estados de una regla</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {STATES.map(([chip, code, text]) => (
              <li key={code} className="flex items-center gap-3"><span className={`chip ${chip} w-12 justify-center`}>{code}</span>{text}</li>
            ))}
          </ul>
        </section>
        <section className="panel p-5">
          <h2 className="text-sm font-semibold">Estados de un escaneo</h2>
          <p className="mt-3 text-sm text-mute">
            <span className="font-mono text-ink">running</span>, <span className="font-mono text-ink">done</span>, <span className="font-mono text-ink">error</span> y <span className="font-mono text-ink">cancelled</span>. El puntaje y la clasificación deben venir del backend. Umbrales acordados: Bajo menos de 50, Parcial de 50 a 84, Alto desde 85.
          </p>
        </section>
      </div>
    </div>
  );
}
