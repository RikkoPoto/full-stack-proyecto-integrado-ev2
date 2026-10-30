import { RULE_STATUS, SCAN_STATUS, CLASSIFICATION, scopeText } from '../domain/constants.js';
import { formatDateTime, hostOf } from './format.js';

export const reportFilename = (scan, ext) => `informe-${hostOf(scan.url)}-${scan.id}.${ext}`;

/** Evita que Excel interprete una celda como fórmula (CSV injection) y escapa comillas. */
export function csvCell(value) {
  let text = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function rows(scan, catalog) {
  const byId = new Map(catalog.rules.map((r) => [r.id, r]));
  const catLabel = new Map(catalog.categories.map((c) => [c.id, c.label]));
  return scan.rules.map((r) => {
    const meta = byId.get(r.id);
    return {
      id: r.id,
      categoria: catLabel.get(meta?.category) ?? '',
      regla: meta?.title ?? r.id,
      resultado: RULE_STATUS[r.status]?.label ?? r.status,
      evidencia: r.evidence ?? '',
      corregir: r.status === 'N' || r.status === 'P' ? (meta?.fix ?? '') : '',
      referencia: meta?.legalRef ?? '',
    };
  });
}

export function buildCsv(scan, catalog) {
  const meta = [
    ['Sitio', scan.url],
    ['Identificador', scan.id],
    ['Fecha y hora', formatDateTime(scan.startedAt)],
    ['Alcance', scopeText(scan.scope)],
    ['Puntaje', scan.score != null ? `${scan.score}%` : ''],
    ['Clasificación', CLASSIFICATION[scan.classification]?.label ?? ''],
    [],
  ];
  const header = ['ID', 'Categoría', 'Regla', 'Resultado', 'Evidencia', 'Qué corregir', 'Referencia normativa'];
  const body = rows(scan, catalog).map((r) => [r.id, r.categoria, r.regla, r.resultado, r.evidencia, r.corregir, r.referencia]);
  const csv = [...meta, header, ...body].map((r) => r.map(csvCell).join(',')).join('\r\n');
  return new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }); // BOM: Excel respeta las tildes
}

export function buildJson(scan, catalog) {
  const data = {
    id: scan.id,
    url: scan.url,
    estado: SCAN_STATUS[scan.status]?.label ?? scan.status,
    inicio: scan.startedAt,
    fin: scan.finishedAt,
    alcance: scan.scope,
    puntaje: scan.score,
    clasificacion: scan.classification,
    reglas: rows(scan, catalog),
  };
  return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
}

export function downloadBlob(blob, filename) {
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
