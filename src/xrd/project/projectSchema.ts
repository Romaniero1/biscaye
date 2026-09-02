import type { ProjectState, SampleState } from '../types';
import { DEFAULT_SETTINGS, EMPTY_RESULT } from '../types';
import type { PairedFiles } from './pairFiles';

export function createSampleState(pair: PairedFiles, wavelength = DEFAULT_SETTINGS.wavelength, glCropRange: readonly [number, number] = [2, 15]): SampleState | null {
  if (!pair.gl) return null;
  return {
    id: crypto.randomUUID(),
    sampleId: pair.sampleId,
    glFileName: pair.gl.fileName,
    vsFileName: pair.vs?.fileName,
    pkFileName: pair.pk?.fileName,
    rawGlData: pair.gl.parsed.points,
    rawVsData: pair.vs?.parsed.points,
    rawPkData: pair.pk?.parsed.points,
    glMetadata: pair.gl.parsed.metadata,
    vsMetadata: pair.vs?.parsed.metadata,
    pkMetadata: pair.pk?.parsed.metadata,
    glCropRange: [glCropRange[0], glCropRange[1]],
    processedGlData: pair.gl.parsed.points,
    wavelength,
    initialBaseline: null,
    vsBaseline: null,
    backgroundPoints: [],
    backgroundCurve: [],
    reflections: {},
    result: { ...EMPTY_RESULT },
    warnings: pair.vs ? [] : ['VS не найден'],
    manualOverrides: { background: false, markers: [] },
    fitted: false,
  };
}

export function createEmptyProject(): ProjectState {
  return { schemaVersion: 1, name: '', settings: { ...DEFAULT_SETTINGS }, samples: [] };
}

export function isProjectState(value: unknown): value is ProjectState {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ProjectState>;
  return candidate.schemaVersion === 1
    && !!candidate.settings
    && typeof candidate.settings.wavelength === 'number'
    && typeof candidate.settings.backgroundPointCount === 'number'
    && Array.isArray(candidate.samples);
}
