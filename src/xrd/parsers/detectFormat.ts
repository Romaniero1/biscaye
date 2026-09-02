import type { ParsedXrd } from '../types';
import { parseDat } from './parseDat';
import { parseTxt } from './parseTxt';
import { parseUxd } from './parseUxd';
import { parseXy } from './parseXy';

export const SUPPORTED_EXTENSIONS = ['dat', 'txt', 'xy', 'uxd'] as const;
export type SupportedExtension = (typeof SUPPORTED_EXTENSIONS)[number];

export function getExtension(fileName: string): SupportedExtension | null {
  const extension = fileName.split('.').at(-1)?.toLowerCase();
  return SUPPORTED_EXTENSIONS.includes(extension as SupportedExtension)
    ? extension as SupportedExtension
    : null;
}

export function parseXrdText(fileName: string, text: string): ParsedXrd {
  const extension = getExtension(fileName);
  if (!extension) throw new Error('Не удалось распознать формат файла');
  switch (extension) {
    case 'dat': return parseDat(text);
    case 'txt': return parseTxt(text);
    case 'xy': return parseXy(text);
    case 'uxd': return parseUxd(text);
  }
}
