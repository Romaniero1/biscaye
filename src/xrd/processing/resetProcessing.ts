import { EMPTY_RESULT, type FitModel, type SampleState } from '../types';
import { initializeBaselines } from './initializeBaselines';
import { initializePeaks } from './initializePeaks';

export function resetSampleProcessing(sample: SampleState, wavelength: number, model: FitModel): SampleState {
  const clean: SampleState = {
    ...sample,
    processedGlData: sample.rawGlData,
    processedVsDoublet: undefined,
    wavelength,
    initialBaseline: null,
    vsBaseline: null,
    backgroundPoints: [],
    backgroundCurve: [],
    reflections: {},
    vsIntensities: undefined,
    result: { ...EMPTY_RESULT },
    warnings: sample.rawVsData ? [] : ['VS не найден'],
    manualOverrides: { background: false, markers: [] },
    fitted: false,
  };
  return initializePeaks(initializeBaselines(clean), model);
}
