import type { BackgroundPoint, XYPoint } from '../types';
import { quantile } from '../math/statistics';

const X_DISTRIBUTION_POWER = 2.1;
const DEFAULT_FIVE_POINT_POSITIONS = [0, 0.055, 0.235, 0.55, 1] as const;

function sortedPoints(controlPoints: readonly XYPoint[]): XYPoint[] {
  return [...controlPoints].sort((a, b) => a.x - b.x);
}

function shapePreservingSlopes(points: readonly XYPoint[]): number[] {
  const count = points.length;
  if (count < 2) return new Array<number>(count).fill(0);
  const steps = Array.from({ length: count - 1 }, (_, index) => points[index + 1].x - points[index].x);
  const secants = steps.map((step, index) => step > 0 ? (points[index + 1].y - points[index].y) / step : 0);
  if (count === 2) return [secants[0], secants[0]];
  const slopes = new Array<number>(count).fill(0);

  for (let index = 1; index < count - 1; index += 1) {
    const previous = secants[index - 1];
    const next = secants[index];
    if (previous === 0 || next === 0 || Math.sign(previous) !== Math.sign(next)) {
      slopes[index] = 0;
      continue;
    }
    const previousStep = steps[index - 1];
    const nextStep = steps[index];
    const previousWeight = 2 * nextStep + previousStep;
    const nextWeight = nextStep + 2 * previousStep;
    slopes[index] = (previousWeight + nextWeight) / (previousWeight / previous + nextWeight / next);
  }

  const endpointSlope = (firstStep: number, secondStep: number, firstSecant: number, secondSecant: number) => {
    let slope = ((2 * firstStep + secondStep) * firstSecant - firstStep * secondSecant) / (firstStep + secondStep);
    if (Math.sign(slope) !== Math.sign(firstSecant)) slope = 0;
    else if (Math.sign(firstSecant) !== Math.sign(secondSecant) && Math.abs(slope) > Math.abs(3 * firstSecant)) slope = 3 * firstSecant;
    return slope;
  };
  slopes[0] = endpointSlope(steps[0], steps[1], secants[0], secants[1]);
  slopes[count - 1] = endpointSlope(
    steps[count - 2],
    steps[count - 3],
    secants[count - 2],
    secants[count - 3],
  );
  return slopes;
}

function uniqueSortedPoints(controlPoints: readonly XYPoint[]): XYPoint[] {
  const points: XYPoint[] = [];
  for (const point of sortedPoints(controlPoints)) {
    if (points.at(-1)?.x === point.x) points[points.length - 1] = point;
    else points.push(point);
  }
  return points;
}

export function smoothBackgroundValue(controlPoints: readonly XYPoint[], x: number): number {
  const points = uniqueSortedPoints(controlPoints);
  if (!points.length) return 0;
  if (points.length === 1 || x <= points[0].x) return points[0].y;
  if (x >= points.at(-1)!.x) return points.at(-1)!.y;
  let segment = 0;
  while (segment < points.length - 2 && x > points[segment + 1].x) segment += 1;
  const left = points[segment];
  const right = points[segment + 1];
  const step = right.x - left.x;
  if (!(step > 0)) return left.y;
  if (points.length === 2) return left.y + ((x - left.x) / step) * (right.y - left.y);
  const slopes = shapePreservingSlopes(points);
  const normalized = (x - left.x) / step;
  const normalizedSquared = normalized ** 2;
  const normalizedCubed = normalizedSquared * normalized;
  const leftValue = 2 * normalizedCubed - 3 * normalizedSquared + 1;
  const leftSlope = normalizedCubed - 2 * normalizedSquared + normalized;
  const rightValue = -2 * normalizedCubed + 3 * normalizedSquared;
  const rightSlope = normalizedCubed - normalizedSquared;
  return leftValue * left.y
    + leftSlope * step * slopes[segment]
    + rightValue * right.y
    + rightSlope * step * slopes[segment + 1];
}

function localLowerEnvelope(data: readonly XYPoint[], point: XYPoint): number {
  const local = data.filter((candidate) => Math.abs(candidate.x - point.x) <= 0.12);
  return quantile((local.length ? local : [point]).map((candidate) => candidate.y), 0.1);
}

function placeInitialPoints(data: readonly XYPoint[], count: number): BackgroundPoint[] {
  const minimumX = data[0].x;
  const maximumX = data.at(-1)!.x;
  const normalizedPositions = count === DEFAULT_FIVE_POINT_POSITIONS.length
    ? DEFAULT_FIVE_POINT_POSITIONS
    : Array.from({ length: count }, (_, index) => (index / (count - 1)) ** X_DISTRIBUTION_POWER);
  const targets = normalizedPositions.map((position) => minimumX + (maximumX - minimumX) * position);
  targets[targets.length - 1] = minimumX < 14 && maximumX > 14 ? 14 : maximumX;

  return targets.map((target, index) => {
    if (index === 0) return { id: crypto.randomUUID(), ...data[0] };
    if (index === count - 1) {
      const local = data.filter((point) => Math.abs(point.x - target) <= 0.2);
      const low = quantile((local.length ? local : data).map((point) => point.y), 0.08);
      return { id: crypto.randomUUID(), x: target, y: low };
    }
    const previousDistance = target - targets[index - 1];
    const nextDistance = targets[index + 1] - target;
    const radius = Math.max(0.14, Math.min(previousDistance, nextDistance) * 0.24);
    const candidates = data.filter((point) => Math.abs(point.x - target) <= radius);
    const local = candidates.length ? candidates : data;
    const low = quantile(local.map((point) => point.y), 0.08);
    return { id: crypto.randomUUID(), x: target, y: low };
  }).sort((a, b) => a.x - b.x);
}

function lowerToEnvelope(data: readonly XYPoint[], initial: readonly BackgroundPoint[]): BackgroundPoint[] {
  let points = initial.map((point) => ({ ...point }));
  for (let iteration = 0; iteration < 2; iteration += 1) {
    const curve = data.map((point) => ({ x: point.x, y: smoothBackgroundValue(points, point.x) }));
    points = points.map((point, index) => {
      if (index === 0 || index === points.length - 1) return point;
      const left = (points[index - 1].x + point.x) / 2;
      const right = (point.x + points[index + 1].x) / 2;
      const violations = curve
        .filter((candidate) => candidate.x >= left && candidate.x <= right)
        .map((candidate) => candidate.y - localLowerEnvelope(data, candidate))
        .filter((value) => value > 0);
      if (!violations.length) return point;
      const correction = quantile(violations, 0.9) * 0.4;
      return { ...point, y: point.y - correction };
    });
  }
  return points;
}

export function createBackgroundPoints(data: readonly XYPoint[], count = 5): readonly BackgroundPoint[] {
  const safeCount = Math.max(3, Math.min(7, Math.round(count)));
  const visible = data.filter((point) => point.x >= 2 && point.x <= 15);
  if (visible.length < 2) return [];
  return lowerToEnvelope(visible, placeInitialPoints(visible, safeCount));
}

export function buildRefinedBackground(data: readonly XYPoint[], controlPoints: readonly BackgroundPoint[]): readonly XYPoint[] {
  return data
    .filter((point) => point.x >= 2 && point.x <= 15)
    .map((point) => ({ x: point.x, y: smoothBackgroundValue(controlPoints, point.x) }));
}
