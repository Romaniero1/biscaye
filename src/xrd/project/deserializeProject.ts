import type { ProjectState } from '../types';
import { isProjectState } from './projectSchema';

export function deserializeProject(json: string): ProjectState {
  const value: unknown = JSON.parse(json);
  if (!isProjectState(value)) throw new Error('Некорректный файл проекта');
  return {
    ...value,
    name: typeof value.name === 'string' ? value.name : '',
    samples: value.samples.map((sample) => ({
      ...sample,
      glCropRange: Array.isArray(sample.glCropRange)
        && sample.glCropRange.length === 2
        && Number.isFinite(sample.glCropRange[0])
        && Number.isFinite(sample.glCropRange[1])
        && sample.glCropRange[0] < sample.glCropRange[1]
        ? [sample.glCropRange[0], sample.glCropRange[1]] as const
        : [2, 15] as const,
    })),
  };
}
