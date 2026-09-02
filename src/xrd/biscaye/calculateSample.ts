import { interpolateY } from '../math/statistics';
import type { SampleState } from '../types';
import { calculateBiscaye } from './calculateBiscaye';
import { splitKaoliniteChlorite } from './splitKaoliniteChlorite';

export function calculateSample(sample: SampleState): SampleState {
  const a17 = sample.reflections.smectite_17?.area ?? null;
  const a10 = sample.reflections.illite_10?.area ?? null;
  const a7 = sample.reflections.ck_7?.area ?? null;
  const preliminary = calculateBiscaye(a17, a10, a7);
  const kMarker = sample.reflections.kaolinite_002;
  const cMarker = sample.reflections.chlorite_004;
  const corrected = sample.processedVsDoublet;
  const kaolinite002 = corrected?.length && kMarker ? interpolateY(corrected, kMarker.center2Theta) : null;
  const chlorite004 = corrected?.length && cMarker ? interpolateY(corrected, cMarker.center2Theta) : null;
  const hasReliableDoublet = !!sample.rawVsData
    && !sample.warnings.includes('K 002 не найден')
    && !sample.warnings.includes('Ch 004 не найден')
    && kaolinite002 !== null && chlorite004 !== null
    && kaolinite002 > 0 && chlorite004 > 0 && kaolinite002 + chlorite004 > 0;
  const result = hasReliableDoublet
    ? splitKaoliniteChlorite(preliminary, kaolinite002, chlorite004)
    : preliminary;
  const warnings = sample.warnings.filter((warning) => warning !== 'Некорректная площадь');
  if (sample.fitted && preliminary.total === null) warnings.push('Некорректная площадь');
  if (sample.rawVsData && preliminary.total !== null && !hasReliableDoublet && !warnings.includes('Дублет не разделён')) warnings.push('Дублет не разделён');
  return {
    ...sample,
    vsIntensities: sample.rawVsData ? { kaolinite002, chlorite004 } : undefined,
    result,
    warnings: [...new Set(warnings)],
  };
}
