/// <reference lib="webworker" />
import { fitSamplePeaks } from '../xrd/processing/fitSample';
import type { FitModel, SampleState } from '../xrd/types';

type FitBatchMessage = { samples: SampleState[]; model: FitModel };

self.onmessage = (event: MessageEvent<FitBatchMessage>) => {
  const { samples, model } = event.data;
  samples.forEach((sample, index) => {
    const result = fitSamplePeaks(sample, model, { optimizeCenters: true });
    self.postMessage({ type: 'progress', sample: result, current: index + 1, total: samples.length });
  });
  self.postMessage({ type: 'complete', total: samples.length });
};
