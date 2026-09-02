import type { SampleState } from '../types';
import { buildExportRows, downloadBlob } from './exportData';

function escapeCell(value: string | number | null): string {
  if (value === null) return '';
  const text = String(value);
  return /[;"\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function exportCsv(samples: readonly SampleState[], fileName = 'biscaye-results.csv'): void {
  const rows = buildExportRows(samples);
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers, ...rows.map((row) => headers.map((header) => row[header]))]
    .map((row) => row.map(escapeCell).join(';'))
    .join('\r\n');
  downloadBlob(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }), fileName);
}
