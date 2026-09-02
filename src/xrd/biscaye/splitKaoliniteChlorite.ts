import type { SampleResult } from '../types';

export function splitKaoliniteChlorite(result: SampleResult, ik: number | null, ic: number | null): SampleResult {
  if (result.chloriteKaolinite === null || ik === null || ic === null || !(ik + ic > 0)) return result;
  const fractionK = ik / (ik + ic);
  const fractionC = ic / (ik + ic);
  if (fractionK < 0 || fractionC < 0 || !Number.isFinite(fractionK) || !Number.isFinite(fractionC)) return result;
  return {
    ...result,
    kaolinite: result.chloriteKaolinite * fractionK,
    chlorite: result.chloriteKaolinite * fractionC,
    total: 100,
  };
}
