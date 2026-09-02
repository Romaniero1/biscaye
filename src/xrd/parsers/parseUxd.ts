import type { ParsedXrd, XYPoint } from '../types';
import { normalizePoints, parseNumericLine } from './common';

function metadataNumber(text: string, key: string): number | undefined {
  const match = text.match(new RegExp(`^\\s*${key}\\s*=\\s*([+-]?[\\d.,]+)`, 'im'));
  if (!match) return undefined;
  const value = Number(match[1].replace(',', '.'));
  return Number.isFinite(value) ? value : undefined;
}

export function parseUxd(text: string): ParsedXrd {
  const startAngle = metadataNumber(text, '_START');
  const stepSize = metadataNumber(text, '_STEPSIZE');
  const lines = text.split(/\r?\n/);
  const paired = lines.map(parseNumericLine).filter((point): point is XYPoint => point !== null);

  let points = normalizePoints(paired);
  if (points.length < 3 && startAngle !== undefined && stepSize !== undefined && stepSize > 0) {
    const intensities: number[] = [];
    let inRawBlock = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (/^_RAW/i.test(trimmed)) {
        inRawBlock = true;
        continue;
      }
      if (inRawBlock && /^_/.test(trimmed)) break;
      if (inRawBlock && /^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:[eE][+-]?\d+)?$/.test(trimmed)) {
        const value = Number(trimmed.replace(',', '.'));
        if (Number.isFinite(value)) intensities.push(value);
      }
    }
    points = intensities.map((y, index) => ({ x: startAngle + index * stepSize, y }));
  }

  if (points.length < 3) throw new Error('Не удалось распознать формат файла');
  return { points, metadata: { sourceFormat: 'uxd', startAngle, stepSize } };
}
