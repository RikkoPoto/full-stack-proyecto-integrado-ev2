// Cliente del backend real. Contrato completo en docs/INTEGRACION_API.md

import { API_URL, PAGE_SIZE } from '../config.js';
import { FINAL_EVENTS } from '../domain/scanReducer.js';
import { http } from './http.js';

const enc = encodeURIComponent;
const query = (params) =>
  new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null).map(([k, v]) => [k, String(v)])).toString();

const EVENT_TYPES = ['progress', 'rule', 'log', 'error', 'cancelled', 'retry', 'done'];
const POLL_MS = 2000;

export const realApi = {
  kind: 'real',
  capabilities: { serverPdf: true },

  getCatalog: () => http('/rules'),
  createScan: ({ url, scope }) => http('/scans', { method: 'POST', body: { url, scope } }),
  listScans: ({ q, status, page = 1, pageSize = PAGE_SIZE } = {}) => http(`/scans?${query({ q, status, page, pageSize })}`),
  getScan: (id) => http(`/scans/${enc(id)}`),
  cancelScan: (id) => http(`/scans/${enc(id)}/cancel`, { method: 'POST' }),
  retryScan: (id) => http(`/scans/${enc(id)}/retry`, { method: 'POST' }),
  deleteScan: (id) => http(`/scans/${enc(id)}`, { method: 'DELETE' }),
  exportReport: (id, format) =>
    http(`/scans/${enc(id)}/report?format=${enc(format)}`, { responseType: 'blob', timeout: 60000, fallbackName: `informe-${id}.${format}` }),

  /**
   * Tiempo real por Server-Sent Events. Si la conexión se cae, pasa a consultar
   * GET /scans/{id} cada 2 s (onSnapshot). Devuelve la función para cancelar.
   */
  subscribe(id, { onEvent, onSnapshot, onError }) {
    let closed = false;
    let source = null;
    let timer = null;

    const stop = () => {
      closed = true;
      source?.close();
      clearInterval(timer);
    };

    const poll = () => {
      if (timer || closed) return;
      const tick = async () => {
        try {
          const scan = await realApi.getScan(id);
          if (closed) return;
          onSnapshot?.(scan);
          if (scan.status !== 'running') stop();
        } catch (err) {
          if (!closed) onError?.(err);
        }
      };
      tick();
      timer = setInterval(tick, POLL_MS);
    };

    if (typeof EventSource === 'undefined') {
      poll();
      return stop;
    }

    // Nota: EventSource no envía cookies (withCredentials:false), coherente con credentials:'omit'.
    source = new EventSource(`${API_URL}/scans/${enc(id)}/events`);
    EVENT_TYPES.forEach((type) =>
      source.addEventListener(type, (msg) => {
        try {
          onEvent({ type, ...JSON.parse(msg.data) });
          if (FINAL_EVENTS.includes(type)) stop();
        } catch {
          /* evento mal formado: se ignora */
        }
      }),
    );
    source.onerror = () => {
      source?.close();
      source = null;
      poll();
    };
    return stop;
  },
};
