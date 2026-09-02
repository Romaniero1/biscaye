import type { ParsedXrd } from '../types';
import { parseDelimited } from './common';

export const parseDat = (text: string): ParsedXrd => parseDelimited(text, { sourceFormat: 'dat' });
