import type { FitModel } from '../types';
import { gaussianArea } from './gaussian';
import { pearsonVIIArea } from './pearsonVII';

export function peakArea(model: FitModel, height: number, fwhm: number, shapeM: number | null): number {
  return model === 'gaussian'
    ? gaussianArea(height, fwhm)
    : pearsonVIIArea(height, fwhm, shapeM ?? Number.NaN);
}
