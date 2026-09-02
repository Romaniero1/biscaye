import type { ParsedXrd } from '../types';
import { parseDelimited } from './common';

export const parseXy = (text: string): ParsedXrd => parseDelimited(text, { sourceFormat: 'xy' });
