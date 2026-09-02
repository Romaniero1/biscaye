import { buildRefinedBackground } from '../baseline/refinedBackground';
import { calculateSample } from '../biscaye/calculateSample';
import { fitPeak } from '../peaks/fitPeak';
import { GL_REFLECTIONS } from '../peaks/reflections';
import type { BackgroundPoint, FitModel, GlReflectionKey, SampleState, XYPoint } from '../types';
import { fitSamplePeaks } from './fitSample';

export function refitMovedGlMarker(sample: SampleState, key: GlReflectionKey, model: FitModel): SampleState {
  const outcome = fitPeak(sample, key, model);
  const definition = GL_REFLECTIONS.find((entry) => entry.key === key)!;
  const warnings = sample.warnings.filter((warning) => warning !== `Один компонент плохо описывает профиль: ${definition.markerLabel}`);
  warnings.push(...outcome.warnings);
  const next = {
    ...sample,
    reflections: { ...sample.reflections, [key]: outcome.fit },
    warnings: [...new Set(warnings)],
  };
  next.fitted = GL_REFLECTIONS.every(({ key: reflectionKey }) => reflectionKey === 'diagnostic_14' || !!next.reflections[reflectionKey]?.converged);
  return calculateSample(next);
}

export function moveBackgroundAndRefit(sample: SampleState, point: BackgroundPoint, model: FitModel): SampleState {
  const backgroundPoints = sample.backgroundPoints
    .map((current) => current.id === point.id ? point : current)
    .sort((a, b) => a.x - b.x);
  const withBackground: SampleState = {
    ...sample,
    backgroundPoints,
    backgroundCurve: buildRefinedBackground(sample.processedGlData, backgroundPoints),
    manualOverrides: { ...sample.manualOverrides, background: true },
  };
  return fitSamplePeaks(withBackground, model);
}

export function addBackgroundPointAndRefit(sample: SampleState, point: XYPoint, model: FitModel): SampleState {
  if (sample.backgroundPoints.length >= 7) {
    return { ...sample, warnings: [...new Set([...sample.warnings, 'Достигнут максимум: 7 точек фона'])] };
  }
  if (sample.backgroundPoints.some((current) => Math.abs(current.x - point.x) < 0.04)) return sample;
  const backgroundPoints = [
    ...sample.backgroundPoints,
    { id: crypto.randomUUID(), x: point.x, y: point.y },
  ].sort((a, b) => a.x - b.x);
  const withBackground: SampleState = {
    ...sample,
    backgroundPoints,
    backgroundCurve: buildRefinedBackground(sample.processedGlData, backgroundPoints),
    warnings: sample.warnings.filter((warning) => warning !== 'Достигнут максимум: 7 точек фона'),
    manualOverrides: { ...sample.manualOverrides, background: true },
  };
  return fitSamplePeaks(withBackground, model);
}
