import { quantile } from '../math/statistics';
import { dToTwoTheta, twoThetaToD } from '../physics/bragg';
import type { FitModel, GlReflectionKey, PeakFit, SampleState, XYPoint } from '../types';
import { gaussianValue } from './gaussian';
import { peakArea } from './peakArea';
import { pearsonVIIValue } from './pearsonVII';
import { GL_REFLECTIONS } from './reflections';
import { getGlSignal } from './detectPeak';

type Bounds = readonly [number, number];
const MIN_PEARSON_SHAPE = 1;

export type FitOutcome = {
  fit: PeakFit;
  warnings: string[];
};

function clamp(value: number, bounds: Bounds): number {
  return Math.max(bounds[0], Math.min(bounds[1], value));
}

function modelValue(model: FitModel, x: number, parameters: readonly number[]): number {
  return model === 'gaussian'
    ? gaussianValue(x, parameters[0], parameters[1], parameters[2])
    : pearsonVIIValue(x, parameters[0], parameters[1], parameters[2], parameters[3]);
}

function objective(model: FitModel, data: readonly XYPoint[], weights: readonly number[], parameters: readonly number[]): number {
  let error = 0;
  let totalWeight = 0;
  for (let index = 0; index < data.length; index += 1) {
    const point = data[index];
    const predicted = modelValue(model, point.x, parameters);
    if (!Number.isFinite(predicted)) return Number.POSITIVE_INFINITY;
    const residual = point.y - predicted;
    error += weights[index] * residual * residual;
    totalWeight += weights[index];
  }
  return error / Math.max(1, totalWeight);
}

function coordinateFit(model: FitModel, data: readonly XYPoint[], initial: number[], bounds: readonly Bounds[], fixedCenter: boolean): { parameters: number[]; error: number } {
  const maximumSignal = Math.max(Number.EPSILON, ...data.map((point) => Math.max(0, point.y)));
  const weights = data.map((point) => {
    const relativeIntensity = Math.max(0, point.y) / maximumSignal;
    return 1 + 3 * relativeIntensity ** 2;
  });
  let parameters = initial.map((value, index) => clamp(value, bounds[index]));
  let error = objective(model, data, weights, parameters);
  let steps = bounds.map(([low, high], index) => index === 1 && fixedCenter ? 0 : (high - low) * 0.16);
  for (let iteration = 0; iteration < 160; iteration += 1) {
    let improved = false;
    for (let index = 0; index < parameters.length; index += 1) {
      if (steps[index] === 0) continue;
      for (const direction of [-1, 1]) {
        const candidate = [...parameters];
        candidate[index] = clamp(candidate[index] + direction * steps[index], bounds[index]);
        const candidateError = objective(model, data, weights, candidate);
        if (candidateError + Number.EPSILON < error) {
          parameters = candidate;
          error = candidateError;
          improved = true;
        }
      }
    }
    if (!improved) steps = steps.map((step) => step * 0.58);
    if (Math.max(...steps) < 1e-6) break;
  }
  return { parameters, error };
}

function estimateFwhm(data: readonly XYPoint[], center: number, height: number, fallback: number): number {
  if (!(height > 0)) return fallback;
  const half = height / 2;
  const left = data.filter((point) => point.x < center && point.y <= half).at(-1);
  const right = data.find((point) => point.x > center && point.y <= half);
  return left && right ? right.x - left.x : fallback;
}

function fitWithModel(sample: SampleState, key: GlReflectionKey, model: FitModel): FitOutcome {
  const definition = GL_REFLECTIONS.find((entry) => entry.key === key)!;
  const current = sample.reflections[key];
  if (!current) return { fit: {
    model, center2Theta: dToTwoTheta(definition.nominalD, sample.wavelength), dAngstrom: definition.nominalD,
    height: 0, fwhm: null, shapeM: null, area: null, converged: false, manuallyPositioned: false,
  }, warnings: ['Фитинг не сошёлся'] };

  const dAngles = definition.dRange.map((d) => dToTwoTheta(d, sample.wavelength));
  const autoWindow: [number, number] = [Math.min(...dAngles), Math.max(...dAngles)];
  const width = autoWindow[1] - autoWindow[0];
  const fitWindow: [number, number] = current.manuallyPositioned
    ? [Math.max(2, current.center2Theta - Math.max(width * 0.65, 0.28)), Math.min(15, current.center2Theta + Math.max(width * 0.65, 0.28))]
    : [Math.max(2, autoWindow[0] - width * 0.3), Math.min(15, autoWindow[1] + width * 0.3)];
  const data = getGlSignal(sample).filter((point) => point.x >= fitWindow[0] && point.x <= fitWindow[1]);
  if (data.length < 7) return { fit: { ...current, model, converged: false, area: null }, warnings: ['Фитинг не сошёлся'] };
  const maxPoint = data.reduce((best, point) => point.y > best.y ? point : best);
  const height = Math.max(current.height, maxPoint.y, 0);
  const step = Math.abs(data[1].x - data[0].x);
  const minFwhm = Math.max(step * 2, 0.025);
  const broadSmectite = key === 'smectite_17';
  const maxFwhm = broadSmectite ? 2.5 : Math.min(2.5, Math.max(width * 1.8, minFwhm * 3));
  const initialFwhm = clamp(estimateFwhm(data, current.center2Theta, height, width * 0.45), [minFwhm, maxFwhm]);
  const centerBounds: Bounds = current.manuallyPositioned ? [current.center2Theta, current.center2Theta] : autoWindow;
  const bounds: Bounds[] = [
    [0, Math.max(height * 3, 1)],
    centerBounds,
    [minFwhm, maxFwhm],
  ];
  const initial = [height, current.manuallyPositioned ? current.center2Theta : maxPoint.x, initialFwhm];
  if (model === 'pearson-vii') {
    bounds.push([MIN_PEARSON_SHAPE, 20]);
    initial.push(current.shapeM && current.shapeM >= MIN_PEARSON_SHAPE ? current.shapeM : 2);
  }
  const optimized = coordinateFit(model, data, initial, bounds, current.manuallyPositioned);
  const [fitHeight, center, fwhm, shapeMValue] = optimized.parameters;
  const shapeM = model === 'pearson-vii' ? shapeMValue : null;
  const area = peakArea(model, fitHeight, fwhm, shapeM);
  const dataScale = Math.max(Number.EPSILON, quantile(data.map((point) => Math.abs(point.y)), 0.9));
  const rmse = Math.sqrt(optimized.error);
  const atMinimumWidth = fwhm <= minFwhm * 1.001;
  const atMaximumWidth = fwhm >= maxFwhm * 0.999;
  const zeroHeight = fitHeight === 0;
  const valid = Number.isFinite(area) && area >= 0 && Number.isFinite(optimized.error)
    && fitHeight >= 0 && fwhm > 0 && (!shapeM || shapeM >= MIN_PEARSON_SHAPE)
    && (zeroHeight || (!atMinimumWidth && (!atMaximumWidth || broadSmectite)));
  const warnings: string[] = [];
  if (valid && (rmse / dataScale > 0.35 || atMaximumWidth)) warnings.push(`Один компонент плохо описывает профиль: ${definition.markerLabel}`);
  return {
    fit: {
      model,
      center2Theta: center,
      dAngstrom: twoThetaToD(center, sample.wavelength),
      height: fitHeight,
      fwhm,
      shapeM,
      area: valid ? area : null,
      converged: valid,
      manuallyPositioned: current.manuallyPositioned,
    },
    warnings: valid ? warnings : ['Фитинг не сошёлся'],
  };
}

export function fitPeak(sample: SampleState, key: GlReflectionKey, requestedModel: FitModel): FitOutcome {
  const primary = fitWithModel(sample, key, requestedModel);
  if (primary.fit.converged || requestedModel === 'gaussian') return primary;
  const fallback = fitWithModel(sample, key, 'gaussian');
  return fallback.fit.converged
    ? { fit: fallback.fit, warnings: ['Pearson VII не сошёлся; использован Gaussian', ...fallback.warnings] }
    : fallback;
}

export function evaluatePeak(fit: PeakFit, x: number): number {
  if (!fit.converged || !fit.fwhm) return 0;
  return fit.model === 'gaussian'
    ? gaussianValue(x, fit.height, fit.center2Theta, fit.fwhm)
    : pearsonVIIValue(x, fit.height, fit.center2Theta, fit.fwhm, fit.shapeM ?? Number.NaN);
}
