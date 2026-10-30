import { describe, expect, it } from 'vitest';
import { classify, calcScore } from '../domain/scoring.js';
import { applyEvent, percentOf } from '../domain/scanReducer.js';
import { buildStages } from '../domain/stages.js';
import { compareScans } from '../domain/compare.js';
import { normalizeUrl } from '../lib/url.js';
import { csvCell, buildCsv } from '../lib/exporters.js';
import { formatDateTime } from '../lib/format.js';
import { CATALOG } from '../api/mock/catalog.js';
import { MIXED, TOTAL_STEPS, rulesFromString } from './fixtures.js';

const blank = () => ({ id: 'X', url: 'https://a.cl', status: 'running', step: 0, total: TOTAL_STEPS, rules: [], log: [], retries: 0, score: null });

describe('clasificación', () => {
  it('respeta los umbrales 50 y 85', () => {
    expect(classify(49)).toBe('bajo');
    expect(classify(50)).toBe('parcial');
    expect(classify(84)).toBe('parcial');
    expect(classify(85)).toBe('alto');
    expect(classify(null)).toBeNull();
  });
});

describe('puntaje', () => {
  it('Cumple=1, Parcial=0,5, No cumple=0 y No evaluable no cuenta', () => {
    const r = calcScore([{ id: 'PRI-01', status: 'C' }, { id: 'PRI-02', status: 'P' }, { id: 'PRI-03', status: 'N' }, { id: 'PRI-04', status: 'E' }], CATALOG.rules);
    expect(r.points).toBe(1.5);
    expect(r.evaluated).toBe(3);
    expect(r.pct).toBe(50);
    expect(r.counts).toEqual({ C: 1, P: 1, N: 1, E: 1 });
  });

  it('calcula 54 % con 7 cumplen, 1 parcial, 6 no cumplen y 1 no evaluable', () => {
    const r = calcScore(rulesFromString(MIXED), CATALOG.rules);
    expect(r.pct).toBe(54);
    expect(r.classification).toBe('parcial');
  });

  it('sin reglas evaluables devuelve null', () => {
    expect(calcScore([{ id: 'PRI-01', status: 'E' }], CATALOG.rules).pct).toBeNull();
  });
});

describe('reducer de eventos', () => {
  it('es idempotente con reglas duplicadas', () => {
    const ev = { type: 'rule', step: 2, total: TOTAL_STEPS, rule: { id: 'PRI-01', status: 'C', evidence: 'ok' } };
    const once = applyEvent(blank(), ev);
    const twice = applyEvent(once, ev);
    expect(twice.rules).toHaveLength(1);
  });

  it('el avance nunca retrocede', () => {
    const s = applyEvent(blank(), { type: 'progress', step: 5 });
    expect(applyEvent(s, { type: 'progress', step: 3 }).step).toBe(5);
  });

  it('error, reintento y fin', () => {
    let s = applyEvent(blank(), { type: 'error', message: 'fallo', code: 'X' });
    expect(s.status).toBe('error');
    s = applyEvent(s, { type: 'retry' });
    expect(s.status).toBe('running');
    expect(s.retries).toBe(1);
    expect(s.errorMessage).toBeNull();
    s = applyEvent(s, { type: 'done', score: 70, classification: 'parcial' });
    expect(s.status).toBe('done');
    expect(percentOf(s)).toBe(100);
  });

  it('descarta logs repetidos', () => {
    const ev = { type: 'log', ts: 't1', text: 'hola' };
    expect(applyEvent(applyEvent(blank(), ev), ev).log).toHaveLength(1);
  });
});

describe('etapas', () => {
  it('marca la primera pendiente como activa y detenida si hay error', () => {
    let s = { ...blank(), step: 3, rules: rulesFromString('CCC').slice(0, 2) };
    expect(buildStages(s, CATALOG).map((x) => x.state)).toEqual(['done', 'active', 'pending', 'pending', 'pending']);
    s = { ...s, status: 'error' };
    expect(buildStages(s, CATALOG)[1].state).toBe('stalled');
  });
});

describe('comparación entre verificaciones', () => {
  it('detecta reglas que mejoraron y empeoraron', () => {
    const prev = { score: 40, rules: [{ id: 'PRI-01', status: 'N' }, { id: 'PRI-02', status: 'C' }, { id: 'PRI-03', status: 'E' }] };
    const cur = { score: 60, rules: [{ id: 'PRI-01', status: 'C' }, { id: 'PRI-02', status: 'P' }, { id: 'PRI-03', status: 'C' }] };
    const c = compareScans(cur, prev);
    expect(c.scoreDelta).toBe(20);
    expect(c.improved).toEqual(['PRI-01']);
    expect(c.worsened).toEqual(['PRI-02']);
  });
});

describe('validación de URL', () => {
  it('normaliza y agrega https', () => {
    expect(normalizeUrl('www.ejemplo.cl').url).toBe('https://www.ejemplo.cl');
    expect(normalizeUrl('https://www.ejemplo.cl/privacidad').url).toBe('https://www.ejemplo.cl/privacidad');
  });
  it.each(['', 'hola', 'a b.cl', 'localhost:3000', 'http://127.0.0.1', 'https://192.168.1.5', 'https://user:pass@ejemplo.cl'])('rechaza %j', (v) => {
    expect(normalizeUrl(v).error).toBeTruthy();
  });
});

describe('exportación', () => {
  it('neutraliza fórmulas en CSV y escapa comillas', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('hola')).toBe('"hola"');
  });
  it('genera un CSV con una fila por regla', async () => {
    const scan = { id: 'V', url: 'https://a.cl', scope: 10, startedAt: '2026-10-28T14:05:12-03:00', score: 54, classification: 'parcial', rules: rulesFromString(MIXED) };
    const text = await buildCsv(scan, CATALOG).text();
    expect(text.split('\r\n').filter((l) => l.startsWith('"PRI-') || l.startsWith('"CON-') || l.startsWith('"DER-'))).toHaveLength(15);
  });
});

describe('formato', () => {
  it('muestra la hora de Chile', () => {
    expect(formatDateTime('2026-10-28T14:05:12-03:00')).toBe('28-10-2026 14:05');
  });
});
