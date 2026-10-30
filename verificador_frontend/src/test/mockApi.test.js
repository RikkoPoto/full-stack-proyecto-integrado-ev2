import { beforeEach, describe, expect, it } from 'vitest';
import { __resetMock, mockApi, simulation } from '../api/mock/mockApi.js';
import { CATALOG } from '../api/mock/catalog.js';
import { applyEvent } from '../domain/scanReducer.js';
import { calcScore } from '../domain/scoring.js';
import { historyFixture } from './fixtures.js';

// El simulador avanza con temporizadores reales; se acelera sustituyendo setTimeout.
const realSetTimeout = globalThis.setTimeout;
beforeEach(() => {
  __resetMock(historyFixture());
  simulation.failMidScan = false;
  globalThis.setTimeout = (fn, ms, ...a) => realSetTimeout(fn, ms > 100 ? 1 : ms, ...a);
});

/** Sigue una verificación aplicando los eventos, igual que lo hace la interfaz (useScanStream). */
function track(initial) {
  let scan = initial;
  const waiters = [];
  const check = () => {
    for (const w of [...waiters]) {
      if (w.statuses.includes(scan.status)) {
        waiters.splice(waiters.indexOf(w), 1);
        w.resolve(scan);
      }
    }
  };
  const off = mockApi.subscribe(scan.id, {
    onEvent: (ev) => {
      scan = applyEvent(scan, ev);
      check();
    },
  });
  return {
    get: () => scan,
    until: (...statuses) => new Promise((resolve) => { waiters.push({ statuses, resolve }); check(); }),
    stop: off,
  };
}

describe('simulador', () => {
  it('el historial empieza vacío cuando no hay datos guardados', async () => {
    __resetMock();
    expect((await mockApi.listScans()).total).toBe(0);
  });

  it('completa un escaneo y calcula el puntaje', async () => {
    const t = track(await mockApi.createScan({ url: 'https://www.sitio.cl', scope: 10 }));
    const done = await t.until('done');
    expect(done.rules).toHaveLength(15);
    const expected = calcScore(done.rules, CATALOG.rules);
    expect(done.score).toBe(expected.pct);
    expect(done.classification).toBe(expected.classification);
  });

  it('da siempre el mismo resultado para el mismo sitio', async () => {
    const a = await track(await mockApi.createScan({ url: 'https://www.sitio.cl', scope: 10 })).until('done');
    const b = await track(await mockApi.createScan({ url: 'https://www.sitio.cl', scope: 10 })).until('done');
    expect(b.rules.map((r) => r.status)).toEqual(a.rules.map((r) => r.status));
  });

  it('falla a mitad de camino y permite reintentar hasta terminar', async () => {
    simulation.failMidScan = true;
    const created = await mockApi.createScan({ url: 'https://www.sitio.cl', scope: 1 });
    const t = track(created);
    const failed = await t.until('error');
    expect(failed.errorMessage).toMatch(/Tiempo de espera/);
    const before = failed.rules.length;
    expect(before).toBeGreaterThan(0);

    await mockApi.retryScan(created.id);
    const done = await t.until('done');
    expect(done.retries).toBe(1);
    expect(done.rules.length).toBeGreaterThan(before); // continúa, no reinicia
  });

  it('cancela un escaneo en curso', async () => {
    globalThis.setTimeout = realSetTimeout; // ritmo real: da tiempo a cancelar antes de que termine
    const created = await mockApi.createScan({ url: 'https://www.sitio.cl', scope: 1 });
    const t = track(created);
    await mockApi.cancelScan(created.id);
    expect((await t.until('cancelled')).status).toBe('cancelled');
  });

  it('rechaza reintentar un escaneo completado', async () => {
    await expect(mockApi.retryScan('VER-A1')).rejects.toMatchObject({ status: 409 });
  });

  it('filtra y pagina el historial', async () => {
    const page = await mockApi.listScans({ pageSize: 2 });
    expect(page.items).toHaveLength(2);
    expect(page.total).toBe(6);
    expect((await mockApi.listScans({ status: 'error' })).total).toBe(1);
    expect((await mockApi.listScans({ q: 'tres' })).total).toBe(1);
  });

  it('elimina una verificación', async () => {
    await mockApi.deleteScan('VER-A6');
    await expect(mockApi.getScan('VER-A6')).rejects.toMatchObject({ status: 404 });
  });
});
