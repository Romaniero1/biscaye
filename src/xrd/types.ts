export type XYPoint = Readonly<{
  x: number;
  y: number;
}>;

export type ReflectionKey =
  | 'smectite_17'
  | 'diagnostic_14'
  | 'illite_10'
  | 'ck_7'
  | 'kaolinite_002'
  | 'chlorite_004';

export type GlReflectionKey = Exclude<ReflectionKey, 'kaolinite_002' | 'chlorite_004'>;
export type VsReflectionKey = Extract<ReflectionKey, 'kaolinite_002' | 'chlorite_004'>;
export type FitModel = 'pearson-vii' | 'gaussian';

export type PeakFit = {
  model: FitModel;
  center2Theta: number;
  dAngstrom: number;
  height: number;
  fwhm: number | null;
  shapeM: number | null;
  area: number | null;
  converged: boolean;
  manuallyPositioned: boolean;
};

export type BackgroundPoint = XYPoint & { id: string };

export type LinearBaseline = {
  slope: number;
  intercept: number;
  anchors: readonly [XYPoint, XYPoint];
};

export type SampleResult = {
  smectiteIS: number | null;
  illite: number | null;
  chloriteKaolinite: number | null;
  chlorite: number | null;
  kaolinite: number | null;
  total: number | null;
};

export type XrdMetadata = {
  stepSize?: number;
  startAngle?: number;
  sourceFormat: 'dat' | 'txt' | 'xy' | 'uxd';
};

export type ParsedXrd = {
  points: readonly XYPoint[];
  metadata: XrdMetadata;
};

export type SampleState = {
  id: string;
  sampleId: string;
  glFileName: string;
  vsFileName?: string;
  pkFileName?: string;
  rawGlData: readonly XYPoint[];
  rawVsData?: readonly XYPoint[];
  rawPkData?: readonly XYPoint[];
  glMetadata: XrdMetadata;
  vsMetadata?: XrdMetadata;
  pkMetadata?: XrdMetadata;
  glCropRange: readonly [number, number];
  processedGlData: readonly XYPoint[];
  processedVsDoublet?: readonly XYPoint[];
  wavelength: number;
  initialBaseline: LinearBaseline | null;
  vsBaseline: LinearBaseline | null;
  backgroundPoints: readonly BackgroundPoint[];
  backgroundCurve: readonly XYPoint[];
  reflections: Partial<Record<ReflectionKey, PeakFit>>;
  vsIntensities?: {
    kaolinite002: number | null;
    chlorite004: number | null;
  };
  result: SampleResult;
  warnings: readonly string[];
  manualOverrides: {
    background: boolean;
    markers: readonly ReflectionKey[];
  };
  fitted: boolean;
};

export type ProjectSettings = {
  wavelength: number;
  radiationLabel: string;
  fitModel: FitModel;
  backgroundPointCount: number;
};

export type ProjectState = {
  schemaVersion: 1;
  name: string;
  savedAt?: string;
  settings: ProjectSettings;
  samples: readonly SampleState[];
};

export const EMPTY_RESULT: SampleResult = {
  smectiteIS: null,
  illite: null,
  chloriteKaolinite: null,
  chlorite: null,
  kaolinite: null,
  total: null,
};

export const DEFAULT_SETTINGS: ProjectSettings = {
  wavelength: 1.5406,
  radiationLabel: 'Cu Kα',
  fitModel: 'pearson-vii',
  backgroundPointCount: 5,
};
