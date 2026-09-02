import { calculateBiscaye } from '../src/xrd/biscaye/calculateBiscaye';
import { splitKaoliniteChlorite } from '../src/xrd/biscaye/splitKaoliniteChlorite';
import { parseDat } from '../src/xrd/parsers/parseDat';
import { identifyXrdFile } from '../src/xrd/project/pairFiles';
import { deserializeProject } from '../src/xrd/project/deserializeProject';
import { dToTwoTheta, twoThetaToD } from '../src/xrd/physics/bragg';
import { gaussianArea, gaussianValue } from '../src/xrd/peaks/gaussian';
import { pearsonVIIArea, pearsonVIIValue } from '../src/xrd/peaks/pearsonVII';
import { GL_REFLECTIONS } from '../src/xrd/peaks/reflections';
import { fitSamplePeaks } from '../src/xrd/processing/fitSample';
import { DEFAULT_SETTINGS, type PeakFit, type SampleState } from '../src/xrd/types';
import { cropGlData } from '../src/xrd/processing/cropGlData';
import { vsDoubletWindow, vsLinearBaseline } from '../src/xrd/baseline/vsLinearBaseline';
import { buildRefinedBackground, createBackgroundPoints, smoothBackgroundValue } from '../src/xrd/baseline/refinedBackground';
import { detectVsReflections, moveDetectedMarker } from '../src/xrd/peaks/detectPeak';
import { buildProjectFileName } from '../src/xrd/export/exportData';
import { fitPeak } from '../src/xrd/peaks/fitPeak';

function assertClose(actual: number | null, expected: number, tolerance: number, label: string) {
  if (actual === null || !Number.isFinite(actual) || Math.abs(actual - expected) > tolerance) {
    throw new Error(`${label}: получено ${actual}, ожидалось ${expected}`);
  }
}

function integrate(fn: (x: number) => number, left: number, right: number, steps = 200_000): number {
  const dx = (right - left) / steps;
  let sum = 0;
  for (let index = 0; index <= steps; index += 1) sum += fn(left + index * dx) * (index === 0 || index === steps ? 0.5 : 1);
  return sum * dx;
}

const wavelength = 1.5406;
for (const d of [17, 14, 10, 7, 3.58, 3.54]) assertClose(twoThetaToD(dToTwoTheta(d, wavelength), wavelength), d, 1e-10, `Bragg ${d} Å`);

const gaussianAnalytic = gaussianArea(120, 0.42);
const gaussianNumeric = integrate((x) => gaussianValue(x, 120, 0, 0.42), -5, 5);
assertClose(gaussianAnalytic, gaussianNumeric, gaussianAnalytic * 1e-6, 'Gaussian area');

const pearsonAnalytic = pearsonVIIArea(120, 0.42, 2.2);
const pearsonNumeric = integrate((x) => pearsonVIIValue(x, 120, 0, 0.42, 2.2), -100, 100);
assertClose(pearsonAnalytic, pearsonNumeric, pearsonAnalytic * 2e-6, 'Pearson VII area');

const biscaye = calculateBiscaye(4, 2, 1);
assertClose(biscaye.smectiteIS, 100 * 4 / 14, 1e-12, 'Biscaye S');
assertClose(biscaye.illite, 100 * 8 / 14, 1e-12, 'Biscaye I');
assertClose(biscaye.chloriteKaolinite, 100 * 2 / 14, 1e-12, 'Biscaye CK');
const zeroAreaBiscaye = calculateBiscaye(0, 2, 1);
assertClose(zeroAreaBiscaye.smectiteIS, 0, 1e-12, 'Biscaye zero S area');
assertClose(zeroAreaBiscaye.illite, 80, 1e-12, 'Biscaye I with zero S area');
assertClose(zeroAreaBiscaye.chloriteKaolinite, 20, 1e-12, 'Biscaye CK with zero S area');
if (calculateBiscaye(0, 0, 0).total !== null) throw new Error('All-zero Biscaye areas cannot be normalized');
const split = splitKaoliniteChlorite(biscaye, 3, 1);
assertClose(split.kaolinite, biscaye.chloriteKaolinite! * 0.75, 1e-12, 'K split');
assertClose(split.chlorite, biscaye.chloriteKaolinite! * 0.25, 1e-12, 'Ch split');

const parsed = parseDat('header\n2,00;10,5\n2,01;11,5\n2,02;12,5');
if (parsed.points.length !== 3 || parsed.points[0].x !== 2 || parsed.points[0].y !== 10.5) throw new Error('DAT decimal comma parsing');
const identity = identifyXrdFile('7.IL.gL.dat');
if (identity?.sampleId !== '7.IL' || identity.state !== 'GL') throw new Error('GL/VS pairing');
const suffixedIdentity = identifyXrdFile('1-6.il.gl_004.txt');
if (suffixedIdentity?.sampleId !== '1-6.il_004' || suffixedIdentity.state !== 'GL') throw new Error('Suffixed GL pairing');
const shortIdentity = identifyXrdFile('4.il.gl.txt');
if (shortIdentity?.sampleId !== '4.il' || shortIdentity.state !== 'GL') throw new Error('Short GL pairing');
const pkIdentity = identifyXrdFile('1-6.il.pk_004.txt');
if (pkIdentity?.sampleId !== '1-6.il_004' || pkIdentity.state !== 'PK') throw new Error('PK pairing');
if (buildProjectFileName('Проект', 6, 'XLSX', 'xlsx') !== 'Проект_6_XLSX.xlsx') throw new Error('Project export filename');

const uncropped = [{ x: 1.5, y: 1 }, { x: 2, y: 2 }, { x: 15, y: 3 }, { x: 16, y: 4 }];
const cropped = cropGlData(uncropped);
if (cropped.length !== 2 || cropped[0].x !== 2 || cropped[1].x !== 15 || uncropped.length !== 4) throw new Error('Immutable GL crop');

const vsWindow = vsDoubletWindow(wavelength);
const vsData = Array.from({ length: 21 }, (_, index) => ({
  x: vsWindow[0] + (index / 20) * (vsWindow[1] - vsWindow[0]),
  y: index === 7 ? 2 : 10 + Math.abs(index - 10),
}));
const vsBaseline = vsLinearBaseline(vsData, wavelength);
if (!vsBaseline.baseline || vsBaseline.baseline.slope !== 0 || vsBaseline.baseline.intercept !== 2) throw new Error('Horizontal VS minimum baseline');
assertClose(Math.min(...vsBaseline.corrected.map((point) => point.y)), 0, 1e-12, 'VS corrected minimum');

const envelopeData = Array.from({ length: 131 }, (_, index) => {
  const x = 2 + index * 0.1;
  return { x, y: 2000 / x + 15 * Math.sin(x) + 20 };
});
const envelopePoints = createBackgroundPoints(envelopeData, 5);
const envelopeCurve = buildRefinedBackground(envelopeData, envelopePoints);
if (envelopePoints[0].x !== 2 || envelopePoints.at(-1)?.x !== 14 || envelopeCurve.some((point) => !Number.isFinite(point.y))) throw new Error('Smooth background endpoints');
assertClose(envelopeCurve.at(-1)?.y ?? null, envelopePoints.at(-1)?.y ?? Number.NaN, 1e-12, 'Flat background extension after final point');
assertClose(envelopePoints[1].x, 2.715, 1e-12, 'Automatic background second point');
assertClose(envelopePoints[2].x, 5.055, 1e-12, 'Automatic background third point');
assertClose(envelopePoints[3].x, 9.15, 1e-12, 'Automatic background fourth point');
const logarithmicBackground = [
  { x: 2, y: 18_000 },
  { x: 2.7, y: 5_200 },
  { x: 5, y: 1_300 },
  { x: 9.1, y: -300 },
  { x: 15, y: 300 },
];
const decay = Array.from({ length: 72 }, (_, index) => smoothBackgroundValue(logarithmicBackground, 2 + index * 0.1));
if (decay.some((value, index) => index > 0 && value > decay[index - 1] + 1e-8)) throw new Error('Shape-preserving background introduced an artificial turn');
const recovery = Array.from({ length: 60 }, (_, index) => smoothBackgroundValue(logarithmicBackground, 9.1 + index * 0.1));
if (recovery.some((value, index) => index > 0 && value < recovery[index - 1] - 1e-8)) throw new Error('Shape-preserving background overshot the final segment');

const syntheticParameters = new Map([
  ['smectite_17', { height: 100, fwhm: 0.28 }],
  ['diagnostic_14', { height: 55, fwhm: 0.24 }],
  ['illite_10', { height: 80, fwhm: 0.22 }],
  ['ck_7', { height: 65, fwhm: 0.3 }],
]);
const syntheticData = Array.from({ length: 1301 }, (_, index) => {
  const x = 2 + index * 0.01;
  const y = GL_REFLECTIONS.reduce((sum, reflection) => {
    const parameter = syntheticParameters.get(reflection.key)!;
    return sum + gaussianValue(x, parameter.height, dToTwoTheta(reflection.nominalD, wavelength), parameter.fwhm);
  }, 0);
  return { x, y };
});
const syntheticReflections = Object.fromEntries(GL_REFLECTIONS.map((reflection) => {
  const parameter = syntheticParameters.get(reflection.key)!;
  const center = dToTwoTheta(reflection.nominalD, wavelength);
  const fit: PeakFit = { model: 'gaussian', center2Theta: center, dAngstrom: reflection.nominalD, height: parameter.height, fwhm: null, shapeM: null, area: null, converged: false, manuallyPositioned: false };
  return [reflection.key, fit];
}));
const syntheticSample: SampleState = {
  id: 'synthetic', sampleId: 'synthetic', glFileName: 'synthetic.GL.dat',
  rawGlData: syntheticData, glMetadata: { sourceFormat: 'dat' }, glCropRange: [2, 15], processedGlData: syntheticData,
  wavelength, initialBaseline: null, vsBaseline: null, backgroundPoints: [], backgroundCurve: [],
  reflections: syntheticReflections, result: { smectiteIS: null, illite: null, chloriteKaolinite: null, chlorite: null, kaolinite: null, total: null },
  warnings: ['VS не найден'], manualOverrides: { background: false, markers: [] }, fitted: false,
};

const zeroSignal = Array.from({ length: 1301 }, (_, index) => ({ x: 2 + index * 0.01, y: 0 }));
const zeroPeakOutcome = fitPeak({
  ...syntheticSample,
  rawGlData: zeroSignal,
  processedGlData: zeroSignal,
  reflections: { smectite_17: { ...syntheticReflections.smectite_17!, height: 0 } },
}, 'smectite_17', 'gaussian');
if (!zeroPeakOutcome.fit.converged || zeroPeakOutcome.fit.area !== 0) throw new Error('Zero-area fitted peak must be valid');

const { glCropRange: _legacyCropRange, ...legacySample } = syntheticSample;
const restoredLegacyProject = deserializeProject(JSON.stringify({ schemaVersion: 1, settings: DEFAULT_SETTINGS, samples: [legacySample] }));
if (restoredLegacyProject.samples[0].glCropRange[0] !== 2 || restoredLegacyProject.samples[0].glCropRange[1] !== 15) throw new Error('Legacy project GL crop range');
if (restoredLegacyProject.name !== '') throw new Error('Legacy project name fallback');

const kTargetD = 3.571;
const cTargetD = 3.541;
const vsDomain = vsDoubletWindow(wavelength);
const syntheticVs = Array.from({ length: 1601 }, (_, index) => {
  const x = vsDomain[0] + (index / 1600) * (vsDomain[1] - vsDomain[0]);
  return {
    x,
    y: 5
      + gaussianValue(x, 100, dToTwoTheta(kTargetD, wavelength), 0.025)
      + gaussianValue(x, 90, dToTwoTheta(cTargetD, wavelength), 0.025)
      + gaussianValue(x, 400, dToTwoTheta(3.59, wavelength), 0.025)
      + gaussianValue(x, 400, dToTwoTheta(3.52, wavelength), 0.025),
  };
});
const detectedVs = detectVsReflections({ ...syntheticSample, rawVsData: syntheticVs, processedVsDoublet: syntheticVs, warnings: [] });
const detectedK = detectedVs.reflections.kaolinite_002?.dAngstrom;
const detectedC = detectedVs.reflections.chlorite_004?.dAngstrom;
assertClose(detectedK ?? null, kTargetD, 0.002, 'K 002 narrow d-window');
assertClose(detectedC ?? null, cTargetD, 0.002, 'Ch 004 narrow d-window');

const fittedSynthetic = fitSamplePeaks(syntheticSample, 'gaussian');
if (!fittedSynthetic.fitted || fittedSynthetic.result.total !== 100) throw new Error('Synthetic batch fit / Biscaye calculation');
for (const reflection of GL_REFLECTIONS) {
  const expected = syntheticParameters.get(reflection.key)!;
  const fit = fittedSynthetic.reflections[reflection.key]!;
  assertClose(fit.fwhm, expected.fwhm, 0.015, `Synthetic ${reflection.key} FWHM`);
}

const illiteCenter = dToTwoTheta(10, wavelength);
const manuallyMoved = moveDetectedMarker(fittedSynthetic, 'illite_10', illiteCenter + 0.12);
const reoptimized = fitSamplePeaks(manuallyMoved, 'gaussian', { optimizeCenters: true });
assertClose(reoptimized.reflections.illite_10?.center2Theta ?? null, illiteCenter, 0.015, 'Explicit fit reoptimizes manually moved center');
if (reoptimized.reflections.illite_10?.manuallyPositioned) throw new Error('Explicit fit retained manual center lock');

const fittedWithAutomaticVs = fitSamplePeaks({
  ...fittedSynthetic,
  rawVsData: syntheticVs,
  processedVsDoublet: syntheticVs,
  reflections: { ...fittedSynthetic.reflections, ...detectedVs.reflections },
  warnings: [],
}, 'gaussian', { optimizeCenters: true });
assertClose(fittedWithAutomaticVs.reflections.kaolinite_002?.dAngstrom ?? null, kTargetD, 0.002, 'Explicit fit positions K 002 maximum');
assertClose(fittedWithAutomaticVs.reflections.chlorite_004?.dAngstrom ?? null, cTargetD, 0.002, 'Explicit fit positions Ch 004 maximum');
if (fittedWithAutomaticVs.result.kaolinite === null || fittedWithAutomaticVs.result.chlorite === null) throw new Error('Automatic VS split requires manual marker click');

console.log('Critical math and parsing checks passed');
