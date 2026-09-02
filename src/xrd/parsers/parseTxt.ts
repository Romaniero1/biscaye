import type { ParsedXrd } from '../types';
import { parseDelimited } from './common';

export const parseTxt = (text: string): ParsedXrd => parseDelimited(text, { sourceFormat: 'txt' });
