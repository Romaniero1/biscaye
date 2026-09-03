import type { ParsedXrd } from '../types';

export type LoadedXrdFile = {
  fileName: string;
  parsed: ParsedXrd;
};

export type PairedFiles = {
  sampleId: string;
  gl?: LoadedXrdFile;
  vs?: LoadedXrdFile;
  pk?: LoadedXrdFile;
  tp?: LoadedXrdFile;
  sp?: LoadedXrdFile;
  ost?: LoadedXrdFile;
};

export type XrdFileState = 'GL' | 'VS' | 'PK' | 'TP' | 'SP' | 'OST';

function pairingKey(sampleId: string): string {
  return sampleId.replace(/\.il(?=([._-]|$))/i, '').toLocaleLowerCase();
}

export function identifyXrdFile(fileName: string): { sampleId: string; state: XrdFileState } | null {
  const withoutExtension = fileName.replace(/\.[^.]+$/, '');
  const match = withoutExtension.match(/^(.*?)[._-](GL|VS|PK|TP|SP|OST)((?:[._-].+)?)$/i);
  if (!match || !match[1]) return null;
  return {
    sampleId: `${match[1]}${match[3] ?? ''}`,
    state: match[2].toUpperCase() as XrdFileState,
  };
}

export function pairXrdFiles(files: readonly LoadedXrdFile[]): PairedFiles[] {
  const paired = new Map<string, PairedFiles>();
  for (const file of files) {
    const identity = identifyXrdFile(file.fileName);
    if (!identity) continue;
    const key = pairingKey(identity.sampleId);
    const entry = paired.get(key) ?? { sampleId: identity.sampleId };
    if (identity.state === 'GL') entry.sampleId = identity.sampleId;
    entry[identity.state.toLowerCase() as 'gl' | 'vs' | 'pk' | 'tp' | 'sp' | 'ost'] = file;
    paired.set(key, entry);
  }
  return [...paired.values()].sort((a, b) => a.sampleId.localeCompare(b.sampleId, undefined, { numeric: true }));
}
