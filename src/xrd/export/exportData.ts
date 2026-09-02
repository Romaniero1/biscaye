import type { SampleState } from '../types';

export type ExportRow = Record<string, string | number | null>;

export function buildProjectFileName(projectName: string, sampleCount: number, format: string, extension: string): string {
  const safeName = projectName.trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
    .replace(/[. ]+$/g, '') || 'Проект';
  return `${safeName}_${sampleCount}_${format}.${extension}`;
}

function rounded(value: number | null): number | null {
  return value === null || !Number.isFinite(value) ? null : Math.round(value * 100) / 100;
}

export function buildExportRows(samples: readonly SampleState[]): ExportRow[] {
  const includeCombined = samples.some((sample) => sample.result.chlorite === null || sample.result.kaolinite === null);
  const includeStatus = samples.some((sample) => sample.warnings.length > 0 || sample.result.total === null);
  return samples.map((sample, index) => {
    const row: ExportRow = {
      '№': index + 1,
      'Образец': sample.glFileName,
      'Smectite + I/S, %': rounded(sample.result.smectiteIS),
      'Illite, %': rounded(sample.result.illite),
      'Chlorite, %': rounded(sample.result.chlorite),
      'Kaolinite, %': rounded(sample.result.kaolinite),
    };
    if (includeCombined) row['Chlorite + Kaolinite, %'] = rounded(sample.result.chloriteKaolinite);
    if (includeStatus) row.Status = sample.warnings.length ? sample.warnings.join('; ') : sample.result.total === null ? 'Нет рассчитанного состава' : '';
    return row;
  });
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
