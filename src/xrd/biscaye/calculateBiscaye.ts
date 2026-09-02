import type { SampleResult } from '../types';
import { EMPTY_RESULT } from '../types';

export function calculateBiscaye(a17: number | null, a10: number | null, a7: number | null): SampleResult {
  if (![a17, a10, a7].every((area) => area !== null && Number.isFinite(area) && area >= 0)) return { ...EMPTY_RESULT };
  const smectite = a17!;
  const illite = 4 * a10!;
  const chloriteKaolinite = 2 * a7!;
  const total = smectite + illite + chloriteKaolinite;
  if (!(total > 0) || !Number.isFinite(total)) return { ...EMPTY_RESULT };
  return {
    smectiteIS: 100 * smectite / total,
    illite: 100 * illite / total,
    chloriteKaolinite: 100 * chloriteKaolinite / total,
    chlorite: null,
    kaolinite: null,
    total: 100,
  };
}
