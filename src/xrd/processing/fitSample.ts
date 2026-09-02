import type { FitModel, SampleState } from '../types';
import { fitPeak } from '../peaks/fitPeak';
import { GL_REFLECTIONS } from '../peaks/reflections';
import { detectVsReflections } from '../peaks/detectPeak';
import { calculateSample } from '../biscaye/calculateSample';

const FIT_WARNINGS = ['Фитинг не сошёлся', 'Pearson VII не сошёлся; использован Gaussian', 'Некорректная площадь'];
const VS_WARNINGS = ['K 002 не найден', 'Ch 004 не найден', 'Дублет не разделён'];

type FitSampleOptions = {
  optimizeCenters?: boolean;
};

export function fitSamplePeaks(sample: SampleState, model: FitModel, options: FitSampleOptions = {}): SampleState {
  let next = sample;
  if (options.optimizeCenters) {
    const reflections = { ...sample.reflections };
    for (const definition of GL_REFLECTIONS) {
      const reflection = reflections[definition.key];
      if (reflection) reflections[definition.key] = { ...reflection, manuallyPositioned: false };
    }
    const glKeys = new Set(GL_REFLECTIONS.map((definition) => definition.key));
    next = {
      ...sample,
      reflections,
      manualOverrides: {
        ...sample.manualOverrides,
        markers: sample.manualOverrides.markers.filter((key) => !glKeys.has(key as typeof GL_REFLECTIONS[number]['key']) && key !== 'kaolinite_002' && key !== 'chlorite_004'),
      },
    };
  }
  const warnings = sample.warnings.filter((warning) => !FIT_WARNINGS.includes(warning)
    && !warning.startsWith('Один компонент плохо описывает профиль:')
    && !(options.optimizeCenters && VS_WARNINGS.includes(warning)));
  for (const definition of GL_REFLECTIONS) {
    const outcome = fitPeak(next, definition.key, model);
    next = { ...next, reflections: { ...next.reflections, [definition.key]: outcome.fit } };
    warnings.push(...outcome.warnings);
    if (outcome.fit.converged && (outcome.fit.area === null || outcome.fit.area < 0 || !Number.isFinite(outcome.fit.area))) warnings.push('Некорректная площадь');
  }
  if (options.optimizeCenters) {
    const vs = detectVsReflections(next);
    next = { ...next, reflections: vs.reflections };
    warnings.push(...vs.warnings);
  }
  return calculateSample({ ...next, warnings: [...new Set(warnings)], fitted: GL_REFLECTIONS.every(({ key }) => key === 'diagnostic_14' || !!next.reflections[key]?.converged) });
}
