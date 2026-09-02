import type { XYPoint } from '../types';

export const DEFAULT_GL_CROP_RANGE = [2, 15] as const;

export function cropGlData(
  rawData: readonly XYPoint[],
  range: readonly [number, number] = DEFAULT_GL_CROP_RANGE,
): readonly XYPoint[] {
  const [minimum, maximum] = range;
  if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum >= maximum) return [];
  return rawData
    .filter((point) => point.x >= minimum && point.x <= maximum)
    .map((point) => ({ x: point.x, y: point.y }));
}
