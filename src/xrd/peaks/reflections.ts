import type { GlReflectionKey, VsReflectionKey } from '../types';

export type GlReflectionDefinition = {
  key: GlReflectionKey;
  dRange: readonly [number, number];
  nominalD: number;
  markerLabel: string;
  warningLabel: string;
  purpose: string;
};

export const GL_REFLECTIONS: readonly GlReflectionDefinition[] = [
  { key: 'smectite_17', dRange: [16, 18], nominalD: 17, markerLabel: '16–18 Å', warningLabel: '16–18 Å', purpose: 'Smectite + I/S' },
  { key: 'diagnostic_14', dRange: [13.5, 14.5], nominalD: 14, markerLabel: '~14 Å', warningLabel: '14 Å', purpose: 'diagnostic' },
  { key: 'illite_10', dRange: [9.7, 10.3], nominalD: 10, markerLabel: '~10 Å', warningLabel: '10 Å', purpose: 'Illite' },
  { key: 'ck_7', dRange: [6.9, 7.3], nominalD: 7, markerLabel: '~7 Å', warningLabel: '7 Å', purpose: 'Chlorite + Kaolinite' },
] as const;

export const VS_REFLECTIONS: Record<VsReflectionKey, { nominalD: number; dRange: readonly [number, number]; markerLabel: string; warning: string; purpose: string }> = {
  kaolinite_002: { nominalD: 3.57, dRange: [3.56, 3.58], markerLabel: 'K 002', warning: 'K 002 не найден', purpose: 'Kaolinite 002' },
  chlorite_004: { nominalD: 3.54, dRange: [3.53, 3.55], markerLabel: 'Ch 004', warning: 'Ch 004 не найден', purpose: 'Chlorite 004' },
};
