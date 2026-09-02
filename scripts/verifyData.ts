declare function require(id: string): { [key: string]: (...args: never[]) => unknown };
declare const process: { cwd(): string };

import { parseXrdText } from '../src/xrd/parsers';
import { createSampleState, pairXrdFiles, type LoadedXrdFile } from '../src/xrd/project';
import { initializeBaselines, refineSampleBackground } from '../src/xrd/processing/initializeBaselines';
import { initializePeaks } from '../src/xrd/processing/initializePeaks';
import { fitSamplePeaks } from '../src/xrd/processing/fitSample';
import { addBackgroundPointAndRefit } from '../src/xrd/processing/reactiveProcessing';
import { smoothBackgroundValue } from '../src/xrd/baseline/refinedBackground';
import { buildDiffractogramSvg } from '../src/xrd/export/exportSvg';
import type { SampleState } from '../src/xrd/types';

const fs = require('node:fs') as unknown as {
  readdirSync(path: string): string[];
  readFileSync(path: string, encoding: string): string;
};
const path = require('node:path') as unknown as { join(...parts: string[]): string };
const dataDirectory = path.join(process.cwd(), 'data');
const loaded: LoadedXrdFile[] = fs.readdirSync(dataDirectory).map((fileName) => ({
  fileName,
  parsed: parseXrdText(fileName, fs.readFileSync(path.join(dataDirectory, fileName), 'utf8')),
}));
const pairs = pairXrdFiles(loaded);
if (pairs.length !== 6 || pairs.some((pair) => !pair.gl || !pair.vs)) {
  throw new Error(`Ожидалось 6 полных GL/VS-пар, получено ${pairs.length}`);
}

const fittedSamples: SampleState[] = [];
const results = pairs.map((pair) => {
  const created = createSampleState(pair);
  if (!created) throw new Error(`Не создан образец ${pair.sampleId}`);
  const initialized = initializePeaks(initializeBaselines(created), 'gaussian');
  if (!initialized.vsBaseline || initialized.vsBaseline.slope !== 0) throw new Error(`VS baseline не горизонтальна: ${pair.sampleId}`);
  const expectedVsMinimum = Math.min(...initialized.rawVsData!.filter((point) => point.x >= initialized.vsBaseline!.anchors[0].x && point.x <= initialized.vsBaseline!.anchors[1].x).map((point) => point.y));
  if (initialized.vsBaseline.intercept !== expectedVsMinimum) throw new Error(`VS baseline не совпала с минимумом: ${pair.sampleId}`);
  const refined = refineSampleBackground(initialized);
  const firstGlX = refined.processedGlData[0].x;
  const lastGlX = refined.processedGlData.at(-1)!.x;
  const expectedLastBackgroundX = firstGlX < 14 && lastGlX > 14 ? 14 : lastGlX;
  if (refined.backgroundPoints[0].x !== refined.processedGlData[0].x || refined.backgroundPoints.at(-1)?.x !== expectedLastBackgroundX) throw new Error(`Крайние точки фона: ${pair.sampleId}`);
  if (refined.backgroundCurve.at(-1)?.y !== refined.backgroundPoints.at(-1)?.y) throw new Error(`Горизонтальное продолжение фона: ${pair.sampleId}`);
  const addedX = 6;
  const withAddedPoint = addBackgroundPointAndRefit(refined, { x: addedX, y: smoothBackgroundValue(refined.backgroundPoints, addedX) }, 'pearson-vii');
  if (withAddedPoint.backgroundPoints.length !== refined.backgroundPoints.length + 1) throw new Error(`Добавление точки фона: ${pair.sampleId}`);
  const fitted = fitSamplePeaks(withAddedPoint, 'pearson-vii');
  for (const fit of Object.values(fitted.reflections)) {
    if (fit?.model === 'pearson-vii' && fit.shapeM !== null && fit.shapeM < 1) throw new Error(`Экстремальный хвост Pearson VII: ${pair.sampleId}`);
  }
  if (fitted.rawVsData && (fitted.result.kaolinite === null || fitted.result.chlorite === null)) throw new Error(`Автоматическое разделение K/Ch: ${pair.sampleId}`);
  fittedSamples.push(fitted);
  return {
    sampleId: fitted.sampleId,
    glPoints: fitted.rawGlData.length,
    vsPoints: fitted.rawVsData?.length ?? 0,
    fitted: fitted.fitted,
    total: fitted.result.total,
    fits: ['smectite_17', 'diagnostic_14', 'illite_10', 'ck_7'].map((key) => {
      const fit = fitted.reflections[key as keyof typeof fitted.reflections];
      return `${key}:${fit?.model}/${fit?.converged ? 'ok' : 'fail'}/w=${fit?.fwhm?.toFixed(3) ?? '—'}`;
    }).join(' '),
    warnings: fitted.warnings.join(' | '),
  };
});

const svg = buildDiffractogramSvg(fittedSamples);
for (const fragment of ['id="air-dry"', 'id="glycol"', 'id="heated"', '>17.5<', '>3.58<', 'θ/2θ (градусы)', 'PK не загружен']) {
  if (!svg.includes(fragment)) throw new Error(`SVG не содержит обязательный элемент: ${fragment}`);
}
if ((svg.match(/class="sample-label"/g) ?? []).length !== fittedSamples.length * 2) throw new Error('SVG sample labels without PK');
const extendedSvg = buildDiffractogramSvg(fittedSamples.map((sample) => ({
  ...sample,
  rawTpData: sample.rawVsData,
  rawSpData: sample.rawVsData,
  rawOstData: sample.rawVsData,
})));
for (const panelId of ['tp', 'sp', 'ost']) {
  if (!extendedSvg.includes(`id="${panelId}"`)) throw new Error(`SVG ${panelId.toUpperCase()} panel`);
}
if (!extendedSvg.includes('height="5765"') || (extendedSvg.match(/>3\.58</g) ?? []).length !== 4) throw new Error('Dynamic SVG panels and VS guides');
if ((extendedSvg.match(/class="sample-label"/g) ?? []).length !== fittedSamples.length * 5) throw new Error('SVG sample labels with TP/SP/OST');

console.table(results);
console.log('Real data parsing and GL/VS pairing checks passed');
