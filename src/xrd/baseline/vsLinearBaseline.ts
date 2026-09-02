import type { LinearBaseline, XYPoint } from '../types';
import { dToTwoTheta } from '../physics/bragg';

export type VsBaselineResult = {
  baseline: LinearBaseline | null;
  corrected: readonly XYPoint[];
  window: readonly [number, number];
};

export function vsDoubletWindow(wavelength: number): [number, number] {
  const expected = [dToTwoTheta(3.57, wavelength), dToTwoTheta(3.54, wavelength)];
  return [Math.min(...expected) - 0.4, Math.max(...expected) + 0.4];
}

export function vsLinearBaseline(rawData: readonly XYPoint[], wavelength: number): VsBaselineResult {
  const window = vsDoubletWindow(wavelength);
  const visible = rawData.filter((point) => point.x >= window[0] && point.x <= window[1]);
  if (visible.length < 6) return { baseline: null, corrected: [], window };
  const minimumIntensity = Math.min(...visible.map((point) => point.y));
  if (!Number.isFinite(minimumIntensity)) return { baseline: null, corrected: [], window };
  const anchors: [XYPoint, XYPoint] = [
    { x: visible[0].x, y: minimumIntensity },
    { x: visible.at(-1)!.x, y: minimumIntensity },
  ];
  const slope = 0;
  const intercept = minimumIntensity;
  return {
    baseline: { slope, intercept, anchors },
    corrected: visible.map((point) => ({ x: point.x, y: point.y - (slope * point.x + intercept) })),
    window,
  };
}
