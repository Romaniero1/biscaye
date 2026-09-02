import type { XYPoint } from '../types';

export function quantile(values: readonly number[], fraction: number): number {
  if (!values.length) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const position = Math.max(0, Math.min(1, fraction)) * (sorted.length - 1);
  const lower = Math.floor(position);
  const weight = position - lower;
  return sorted[lower] * (1 - weight) + sorted[Math.min(lower + 1, sorted.length - 1)] * weight;
}

export function medianAbsoluteDeviation(values: readonly number[]): number {
  const median = quantile(values, 0.5);
  return quantile(values.map((value) => Math.abs(value - median)), 0.5) * 1.4826;
}

export function linearRegression(points: readonly XYPoint[]): { slope: number; intercept: number } {
  if (points.length < 2) return { slope: 0, intercept: points[0]?.y ?? 0 };
  const meanX = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const meanY = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  let numerator = 0;
  let denominator = 0;
  for (const point of points) {
    numerator += (point.x - meanX) * (point.y - meanY);
    denominator += (point.x - meanX) ** 2;
  }
  const slope = denominator > 0 ? numerator / denominator : 0;
  return { slope, intercept: meanY - slope * meanX };
}

export function interpolateY(points: readonly XYPoint[], x: number): number {
  if (!points.length) return Number.NaN;
  if (x <= points[0].x) return points[0].y;
  if (x >= points[points.length - 1].x) return points[points.length - 1].y;
  let low = 0;
  let high = points.length - 1;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (points[middle].x <= x) low = middle;
    else high = middle;
  }
  const left = points[low];
  const right = points[high];
  const weight = (x - left.x) / (right.x - left.x);
  return left.y * (1 - weight) + right.y * weight;
}
