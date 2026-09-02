import type { SampleState } from '../types';
import { initialLinearBaseline } from '../baseline/initialLinearBaseline';
import { buildRefinedBackground, createBackgroundPoints } from '../baseline/refinedBackground';
import { vsLinearBaseline } from '../baseline/vsLinearBaseline';
import { cropGlData } from './cropGlData';

export function initializeBaselines(sample: SampleState): SampleState {
  const croppedGl = cropGlData(sample.rawGlData, sample.glCropRange);
  const gl = initialLinearBaseline(croppedGl);
  const vs = sample.rawVsData ? vsLinearBaseline(sample.rawVsData, sample.wavelength) : null;
  const warnings = [...sample.warnings];
  if (sample.rawVsData && !vs?.baseline) warnings.push('Некорректная локальная baseline VS');
  return {
    ...sample,
    processedGlData: gl.corrected,
    processedVsDoublet: vs?.corrected,
    initialBaseline: gl.baseline,
    vsBaseline: vs?.baseline ?? null,
    warnings,
  };
}

export function refineSampleBackground(sample: SampleState, count = 5): SampleState {
  const backgroundPoints = createBackgroundPoints(sample.processedGlData, count);
  return {
    ...sample,
    backgroundPoints,
    backgroundCurve: buildRefinedBackground(sample.processedGlData, backgroundPoints),
    manualOverrides: { ...sample.manualOverrides, background: false },
  };
}
