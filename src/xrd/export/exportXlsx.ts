import type { SampleState } from '../types';
import { buildExportRows, downloadBlob } from './exportData';

export async function exportXlsx(samples: readonly SampleState[], fileName = 'biscaye-results.xlsx'): Promise<void> {
  const rows = buildExportRows(samples);
  if (!rows.length) return;
  const XLSX = await import('xlsx');
  const worksheet = XLSX.utils.json_to_sheet(rows, { cellDates: false });
  worksheet['!cols'] = Object.keys(rows[0]).map((header) => ({ wch: Math.max(10, Math.min(55, header.length + 4)) }));
  const range = XLSX.utils.decode_range(worksheet['!ref'] ?? 'A1:A1');
  for (let row = 1; row <= range.e.r; row += 1) {
    for (let column = 2; column <= range.e.c; column += 1) {
      const cell = worksheet[XLSX.utils.encode_cell({ r: row, c: column })];
      if (cell?.t === 'n') cell.z = '0.00';
    }
  }
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Biscaye');
  const data = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
  downloadBlob(new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileName);
}
