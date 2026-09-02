import type { ParsedXrd, XYPoint, XrdMetadata } from '../types';

const NUMBER = /^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:[eE][+-]?\d+)?$/;

function parseNumber(token: string): number | null {
  const normalized = token.trim().replace(',', '.');
  if (!NUMBER.test(token.trim())) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function parseCandidate(tokens: string[]): XYPoint | null {
  if (tokens.length < 2) return null;
  const x = parseNumber(tokens[0]);
  const y = parseNumber(tokens[1]);
  return x === null || y === null ? null : { x, y };
}

export function parseNumericLine(line: string): XYPoint | null {
  const value = line.trim();
  if (!value || value.startsWith('#') || value.startsWith('//')) return null;

  const structured = value.includes(';')
    ? value.split(';')
    : value.includes('\t')
      ? value.split(/\t+/)
      : value.split(/\s+/);
  const structuredPoint = parseCandidate(structured.filter(Boolean));
  if (structuredPoint) return structuredPoint;

  if (value.includes(',')) {
    const commaPoint = parseCandidate(value.split(',').filter(Boolean));
    if (commaPoint) return commaPoint;
  }
  return null;
}

export function normalizePoints(points: readonly XYPoint[]): readonly XYPoint[] {
  const finite = points.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  const sorted = finite.every((point, index) => index === 0 || point.x >= finite[index - 1].x)
    ? [...finite]
    : [...finite].sort((a, b) => a.x - b.x);
  const unique: XYPoint[] = [];
  for (const point of sorted) {
    const previous = unique.at(-1);
    if (previous?.x === point.x) {
      unique[unique.length - 1] = point;
    } else {
      unique.push(point);
    }
  }
  return unique;
}

export function parseDelimited(
  text: string,
  metadata: XrdMetadata,
): ParsedXrd {
  const points = normalizePoints(text.split(/\r?\n/).map(parseNumericLine).filter((point): point is XYPoint => point !== null));
  if (points.length < 3) throw new Error('Не удалось распознать формат файла');
  return { points, metadata };
}
