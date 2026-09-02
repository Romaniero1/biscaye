import type { ProjectState } from '../types';

export function serializeProject(project: ProjectState): string {
  return JSON.stringify({ ...project, savedAt: new Date().toISOString() });
}
