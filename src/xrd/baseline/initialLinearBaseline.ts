import type { LinearBaseline, XYPoint } from '../types';
import { linearRegression, quantile } from '../math/statistics';

export type InitialBaselineResult = {
  baseline: LinearBaseline;
  corrected: readonly XYPoint[];
};

export function initialLinearBaseline(rawData: readonly XYPoint[]): InitialBaselineResult {
  const right = rawData.filter((point) => point.x >= 10.5 && point.x <= 15);
  const source = right.length >= 8 ? right : rawData.filter((point) => point.x >= 2 && point.x <= 15);
  if (source.length < 2) {
    const zero: LinearBaseline = { slope: 0, intercept: 0, anchors: [{ x: 2, y: 0 }, { x: 15, y: 0 }] };
    return { baseline: zero, corrected: rawData.map((point) => ({ ...point })) };
  }

  const binCount = Math.min(9, Math.max(3, Math.floor(source.length / 8)));
  const minX = source[0].x;
  const maxX = source[source.length - 1].x;
  const binWidth = (maxX - minX) / binCount;
  const lowerEnvelope: XYPoint[] = [];
  for (let bin = 0; bin < binCount; bin += 1) {
    const start = minX + bin * binWidth;
    const end = bin === binCount - 1 ? maxX + Number.EPSILON : start + binWidth;
    const segment = source.filter((point) => point.x >= start && point.x < end);
    if (!segment.length) continue;
    const low = quantile(segment.map((point) => point.y), 0.12);
    const candidate = segment.reduce((best, point) => Math.abs(point.y - low) < Math.abs(best.y - low) ? point : best);
    lowerEnvelope.push(candidate);
  }

  let fitPoints = lowerEnvelope;
  for (let iteration = 0; iteration < 2 && fitPoints.length >= 4; iteration += 1) {
    const fit = linearRegression(fitPoints);
    const residuals = fitPoints.map((point) => point.y - (fit.slope * point.x + fit.intercept));
    const cutoff = quantile(residuals, 0.75);
    fitPoints = fitPoints.filter((_, index) => residuals[index] <= cutoff);
  }
  if (fitPoints.length < 2) fitPoints = [source[0], source[source.length - 1]];
  const { slope, intercept } = linearRegression(fitPoints);
  const anchors: [XYPoint, XYPoint] = [
    { x: rawData[0]?.x ?? 2, y: slope * (rawData[0]?.x ?? 2) + intercept },
    { x: rawData.at(-1)?.x ?? 15, y: slope * (rawData.at(-1)?.x ?? 15) + intercept },
  ];
  return {
    baseline: { slope, intercept, anchors },
    corrected: rawData.map((point) => ({ x: point.x, y: point.y - (slope * point.x + intercept) })),
  };
}
