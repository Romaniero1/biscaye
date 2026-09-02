import type { FitModel, SampleState } from '../types';
import { detectGlReflections, detectVsReflections } from '../peaks/detectPeak';

export function initializePeaks(sample: SampleState, model: FitModel): SampleState {
  const gl = detectGlReflections(sample, model);
  const withGl: SampleState = { ...sample, reflections: gl.reflections, warnings: [...sample.warnings, ...gl.warnings] };
  const vs = detectVsReflections(withGl);
  return { ...withGl, reflections: vs.reflections, warnings: [...withGl.warnings, ...vs.warnings] };
}
