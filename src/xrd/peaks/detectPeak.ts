import { smoothBackgroundValue } from '../baseline/refinedBackground';
import { medianAbsoluteDeviation, quantile } from '../math/statistics';
import { dToTwoTheta, twoThetaToD } from '../physics/bragg';
import type { FitModel, PeakFit, ReflectionKey, SampleState, VsReflectionKey, XYPoint } from '../types';
import { GL_REFLECTIONS, VS_REFLECTIONS } from './reflections';

type Detection = { fit: PeakFit; warnings: string[] };

export function getGlSignal(sample: SampleState): readonly XYPoint[] {
  return sample.processedGlData
    .filter((point) => point.x >= 2 && point.x <= 15)
    .map((point) => ({
      x: point.x,
      y: point.y - (sample.backgroundPoints.length ? smoothBackgroundValue(sample.backgroundPoints, point.x) : 0),
    }));
}

function detectInWindow(
  data: readonly XYPoint[],
  window: readonly [number, number],
  nominalX: number,
  wavelength: number,
  model: FitModel,
  warningLabel: string,
): Detection {
  const local = data.filter((point) => point.x >= window[0] && point.x <= window[1]);
  const maximum = local.reduce<XYPoint | null>((best, point) => !best || point.y > best.y ? point : best, null);
  const values = local.map((point) => point.y);
  const lower = quantile(values, 0.2);
  const noise = medianAbsoluteDeviation(values.slice(1).map((value, index) => value - values[index])) / Math.SQRT2;
  const prominence = maximum ? maximum.y - lower : 0;
  const scale = values.length ? Math.max(...values) - Math.min(...values) : 0;
  const reliable = !!maximum && local.length >= 3 && prominence > Math.max(3 * noise, scale * 0.08, Number.EPSILON);
  const center = reliable ? maximum.x : nominalX;
  const height = reliable ? Math.max(0, maximum.y) : Math.max(0, lower || 0);
  const warnings = reliable ? [] : [`Максимум не найден: ${warningLabel}`];
  const step = local.length > 1 ? Math.abs(local[1].x - local[0].x) : 0;
  if (reliable && (Math.abs(center - window[0]) <= step || Math.abs(center - window[1]) <= step)) {
    warnings.push('Пик достиг границы автоматического поискового окна');
  }
  if (reliable && prominence <= Math.max(5 * noise, Number.EPSILON)) warnings.push('Низкая интенсивность / проверьте пик');
  return {
    fit: {
      model,
      center2Theta: center,
      dAngstrom: twoThetaToD(center, wavelength),
      height,
      fwhm: null,
      shapeM: null,
      area: null,
      converged: false,
      manuallyPositioned: false,
    },
    warnings,
  };
}

export function detectGlReflections(sample: SampleState, model: FitModel): { reflections: Partial<Record<ReflectionKey, PeakFit>>; warnings: string[] } {
  const signal = getGlSignal(sample);
  const reflections: Partial<Record<ReflectionKey, PeakFit>> = { ...sample.reflections };
  const warnings: string[] = [];
  for (const definition of GL_REFLECTIONS) {
    const angles = definition.dRange.map((d) => dToTwoTheta(d, sample.wavelength));
    const window: [number, number] = [Math.min(...angles), Math.max(...angles)];
    const result = detectInWindow(signal, window, dToTwoTheta(definition.nominalD, sample.wavelength), sample.wavelength, model, definition.warningLabel);
    reflections[definition.key] = result.fit;
    warnings.push(...result.warnings);
  }
  return { reflections, warnings };
}

export function detectVsReflections(sample: SampleState): { reflections: Partial<Record<ReflectionKey, PeakFit>>; warnings: string[] } {
  if (!sample.processedVsDoublet?.length) return { reflections: sample.reflections, warnings: [] };
  const reflections: Partial<Record<ReflectionKey, PeakFit>> = { ...sample.reflections };
  const warnings: string[] = [];
  for (const key of Object.keys(VS_REFLECTIONS) as VsReflectionKey[]) {
    const definition = VS_REFLECTIONS[key];
    const angles = definition.dRange.map((d) => dToTwoTheta(d, sample.wavelength));
    const window: [number, number] = [Math.min(...angles), Math.max(...angles)];
    const nominal = dToTwoTheta(definition.nominalD, sample.wavelength);
    const local = sample.processedVsDoublet.filter((point) => point.x >= window[0] && point.x <= window[1]);
    const maximum = local.reduce<XYPoint | null>((best, point) => !best || point.y > best.y ? point : best, null);
    const center = maximum?.x ?? nominal;
    reflections[key] = {
      model: 'gaussian',
      center2Theta: center,
      dAngstrom: twoThetaToD(center, sample.wavelength),
      height: Math.max(0, maximum?.y ?? 0),
      fwhm: null,
      shapeM: null,
      area: null,
      converged: false,
      manuallyPositioned: false,
    };
    if (!maximum) warnings.push(definition.warning);
  }
  if (warnings.length === 2) warnings.push('Дублет не разделён');
  return { reflections, warnings };
}

const NOT_FOUND_WARNING: Record<ReflectionKey, string> = {
  smectite_17: 'Максимум не найден: 16–18 Å',
  diagnostic_14: 'Максимум не найден: 14 Å',
  illite_10: 'Максимум не найден: 10 Å',
  ck_7: 'Максимум не найден: 7 Å',
  kaolinite_002: 'K 002 не найден',
  chlorite_004: 'Ch 004 не найден',
};

export function moveDetectedMarker(sample: SampleState, key: ReflectionKey, center2Theta: number): SampleState {
  const existing = sample.reflections[key];
  if (!existing) return sample;
  const source = key === 'kaolinite_002' || key === 'chlorite_004' ? sample.processedVsDoublet ?? [] : getGlSignal(sample);
  const nearest = source.reduce<XYPoint | null>((best, point) => !best || Math.abs(point.x - center2Theta) < Math.abs(best.x - center2Theta) ? point : best, null);
  const manualMarkers = sample.manualOverrides.markers.includes(key)
    ? sample.manualOverrides.markers
    : [...sample.manualOverrides.markers, key];
  return {
    ...sample,
    reflections: {
      ...sample.reflections,
      [key]: {
        ...existing,
        center2Theta,
        dAngstrom: twoThetaToD(center2Theta, sample.wavelength),
        height: Math.max(0, nearest?.y ?? 0),
        area: null,
        converged: false,
        manuallyPositioned: true,
      },
    },
    warnings: sample.warnings.filter((warning) => warning !== NOT_FOUND_WARNING[key]),
    manualOverrides: { ...sample.manualOverrides, markers: manualMarkers },
    fitted: false,
  };
}
