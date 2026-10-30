// Simulador del backend. Implementa la MISMA interfaz que realApi y emite los MISMOS eventos
// que enviaría el servidor, así la interfaz se desarrolla y prueba igual que en producción.
// Solo para desarrollo: guarda los datos en el localStorage del navegador.

import { PAGE_SIZE } from '../../config.js';
import { RULE_STATUS } from '../../domain/constants.js';
import { applyEvent } from '../../domain/scanReducer.js';
import { calcScore } from '../../domain/scoring.js';
import { buildCsv, buildJson, reportFilename } from '../../lib/exporters.js';
import { hostOf } from '../../lib/format.js';
import { ApiError } from '../http.js';
import { CATALOG, TOTAL_STEPS, evidenceFor } from './catalog.js';

// v3: el historial del simulador ahora empieza vacío (se descarta el que dejó la versión con datos de ejemplo).
const KEY = 'verificador.mock.v3';
const TICK_MS = 650;
const FAIL_AT_STEP = 8;

/** Controles del panel de simulación (solo modo demostración). */
export const simulation = { failMidScan: false };

/* ---------- Almacenamiento ---------- */
const memory = new Map();
const storage = {
  get: (k) => {
    try {
      return localStorage.getItem(k) ?? memory.get(k) ?? null;
    } catch {
      return memory.get(k) ?? null;
    }
  },
  set: (k, v) => {
    memory.set(k, v);
    try {
      localStorage.setItem(k, v);
    } catch {
      /* sin almacenamiento */
    }
  },
};

const now = () => new Date().toISOString();
const clone = (x) => JSON.parse(JSON.stringify(x));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function load() {
  let list;
  try {
    list = JSON.parse(storage.get(KEY) ?? 'null');
  } catch {
    list = null;
  }
  if (!Array.isArray(list)) list = [];
  // Un escaneo que seguía "en curso" al recargar quedó interrumpido: se puede reintentar.
  return list.map((s) =>
    s.status === 'running'
      ? { ...s, status: 'cancelled', finishedAt: now(), log: [...s.log, { ts: now(), level: 'error', text: 'El proceso se interrumpió antes de terminar.' }] }
      : s,
  );
}

let scans = load();
const listeners = new Map();
const timers = new Map();

const persist = () => storage.set(KEY, JSON.stringify(scans));
const find = (id) => scans.find((s) => s.id === id);
const notFound = () => new ApiError('No se encontró la verificación solicitada.', { status: 404 });

function patch(id, fields) {
  scans = scans.map((s) => (s.id === id ? { ...s, ...fields } : s));
}

function emit(id, event) {
  const current = find(id);
  if (!current) return;
  scans = scans.map((s) => (s.id === id ? applyEvent(s, event) : s));
  persist();
  listeners.get(id)?.forEach((fn) => fn(event));
}

const log = (id, level, text) => emit(id, { type: 'log', ts: now(), level, text });

/* ---------- Resultados simulados ---------- */
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % 100;
}

/** Resultado simulado y estable: el mismo sitio y regla dan siempre lo mismo. */
function resultFor(url, ruleId) {
  const h = hash(url + ruleId);
  return h < 50 ? 'C' : h < 65 ? 'P' : h < 93 ? 'N' : 'E';
}

/* ---------- Motor de escaneo ---------- */
function schedule(id) {
  clearTimeout(timers.get(id));
  timers.set(id, setTimeout(() => tick(id), TICK_MS));
}

function tick(id) {
  const scan = find(id);
  if (!scan || scan.status !== 'running') return;
  const i = scan.step; // índice del paso que se ejecuta ahora
  const total = scan.total;
  const nRules = CATALOG.rules.length;

  const shouldFail = (simulation.failMidScan || hostOf(scan.url).includes('error')) && !scan.sim?.failedOnce;
  if (shouldFail && i === FAIL_AT_STEP) {
    patch(id, { sim: { failedOnce: true } });
    const message = 'Tiempo de espera agotado al descargar /derechos (15 s sin respuesta).';
    log(id, 'error', `ERROR ${message}`);
    emit(id, { type: 'error', code: 'FETCH_TIMEOUT', message, ts: now() });
    return;
  }

  if (i === 0) {
    log(id, 'info', `Conectando con ${hostOf(scan.url)}…`);
    log(id, 'info', 'Respuesta HTTP 200. Página de inicio descargada (184 KB).');
    emit(id, { type: 'progress', step: 1, total });
  } else if (i <= nRules) {
    const rule = CATALOG.rules[i - 1];
    const status = resultFor(scan.url, rule.id);
    const level = { C: 'ok', P: 'warn', N: 'fail', E: 'na' }[status];
    log(id, level, `${rule.id} ${RULE_STATUS[status].label.toLowerCase()} · ${rule.title}`);
    emit(id, { type: 'rule', step: i + 1, total, rule: { id: rule.id, status, evidence: evidenceFor(rule.id, status) } });
  } else {
    log(id, 'info', 'Calculando porcentaje y clasificación…');
    const { pct, classification } = calcScore(find(id).rules, CATALOG.rules);
    log(id, 'info', `Escaneo completado. Cumplimiento: ${pct}%.`);
    emit(id, { type: 'done', score: pct, classification, finishedAt: now() });
    return;
  }
  schedule(id);
}

function nextId() {
  const d = new Date();
  const day = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const max = scans.reduce((m, s) => Math.max(m, Number(s.id.split('-')[2]) || 0), 142);
  return `VER-${day}-${String(max + 1).padStart(4, '0')}`;
}

/* ---------- Interfaz pública (igual a realApi) ---------- */
const summary = ({ rules, log: _log, sim, step, total, ...rest }) => rest;

export const mockApi = {
  kind: 'mock',
  capabilities: { serverPdf: false },

  async getCatalog() {
    await wait(120);
    return clone(CATALOG);
  },

  async createScan({ url, scope }) {
    await wait(250);
    const id = nextId();
    const scan = {
      id, url, scope, startedAt: now(), finishedAt: null, status: 'running', step: 0, total: TOTAL_STEPS,
      retries: 0, rules: [], log: [], errorMessage: null, score: null, classification: null,
    };
    scans = [scan, ...scans];
    persist();
    log(id, 'info', `Verificación iniciada para ${hostOf(url)}.`);
    schedule(id);
    return clone(find(id));
  },

  async listScans({ q = '', status = '', page = 1, pageSize = PAGE_SIZE } = {}) {
    await wait(150);
    const term = q.trim().toLowerCase();
    const filtered = scans.filter((s) => (!status || s.status === status) && (!term || s.url.toLowerCase().includes(term)));
    const start = (page - 1) * pageSize;
    return { items: clone(filtered.slice(start, start + pageSize).map(summary)), total: filtered.length, page, pageSize };
  },

  async getScan(id) {
    await wait(80);
    const scan = find(id);
    if (!scan) throw notFound();
    return clone(scan);
  },

  async cancelScan(id) {
    await wait(100);
    const scan = find(id);
    if (!scan) throw notFound();
    if (scan.status !== 'running') throw new ApiError('La verificación ya terminó.', { status: 409 });
    clearTimeout(timers.get(id));
    log(id, 'error', 'Escaneo interrumpido por la persona.');
    emit(id, { type: 'cancelled', ts: now() });
  },

  async retryScan(id) {
    await wait(150);
    const scan = find(id);
    if (!scan) throw notFound();
    if (scan.status !== 'error' && scan.status !== 'cancelled') {
      throw new ApiError('Solo se pueden reintentar verificaciones con error o interrumpidas.', { status: 409 });
    }
    emit(id, { type: 'retry', retries: scan.retries + 1 });
    log(id, 'info', `Reintento n.º ${scan.retries + 1}. Continúa desde el paso ${scan.step + 1}.`);
    schedule(id);
  },

  async deleteScan(id) {
    await wait(120);
    if (!find(id)) throw notFound();
    clearTimeout(timers.get(id));
    scans = scans.filter((s) => s.id !== id);
    persist();
  },

  async exportReport(id, format) {
    await wait(200);
    const scan = find(id);
    if (!scan) throw notFound();
    const blob = format === 'csv' ? buildCsv(scan, CATALOG) : buildJson(scan, CATALOG);
    return { blob, filename: reportFilename(scan, format) };
  },

  subscribe(id, { onEvent, onError }) {
    if (!find(id)) {
      queueMicrotask(() => onError?.(notFound()));
      return () => {};
    }
    if (!listeners.has(id)) listeners.set(id, new Set());
    listeners.get(id).add(onEvent);
    return () => listeners.get(id)?.delete(onEvent);
  },
};

/** Solo para pruebas: reinicia el simulador. */
export function __resetMock(list = []) {
  timers.forEach(clearTimeout);
  timers.clear();
  listeners.clear();
  scans = list;
  persist();
}
