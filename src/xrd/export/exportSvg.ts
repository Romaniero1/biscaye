import { quantile } from '../math/statistics';
import { dToTwoTheta } from '../physics/bragg';
import type { SampleState, XYPoint } from '../types';
import { downloadBlob } from './exportData';

const SVG_WIDTH = 1500;
const BASE_SVG_HEIGHT = 2360;
const FULL_PANEL_HEIGHT = 1085;
const FULL_PANEL_GAP = 50;
const CURVE_COLORS = ['#ff1717', '#1428ff', '#138c1b', '#ffa20b', '#86118d', '#303030', '#f01818'] as const;

type Frame = Readonly<{ x: number; y: number; width: number; height: number }>;
type Guide = Readonly<{ d: number; label: string; level?: number }>;
type Panel = Readonly<{
  id: string;
  label: string;
  frame: Frame;
  xDomain: readonly [number, number];
  guides: readonly Guide[];
  data: (sample: SampleState) => readonly XYPoint[] | undefined;
  emptyText: string;
}>;

const AIR_DRY_GUIDES: readonly Guide[] = [
  { d: 14, label: '14' },
  { d: 10, label: '10' },
  { d: 7.1, label: '7.1' },
  { d: 5, label: '5.0' },
  { d: 4.7, label: '4.7' },
  { d: 4.5, label: '4.5' },
  { d: 4.25, label: '4.25' },
  { d: 3.58, label: '3.58' },
  { d: 3.54, label: '3.54', level: 1 },
  { d: 3.34, label: '3.34' },
  { d: 3.24, label: '3.24', level: 1 },
  { d: 3.19, label: '3.19' },
];

const GL_GUIDES: readonly Guide[] = [
  { d: 17.5, label: '17.5' },
  { d: 14, label: '14' },
  { d: 10, label: '10' },
  { d: 7.1, label: '7.1' },
];

const PK_GUIDES: readonly Guide[] = [
  { d: 14, label: '14' },
  { d: 10, label: '10' },
  { d: 7.1, label: '7.1' },
];

function number(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function xPosition(value: number, domain: readonly [number, number], left: number, width: number): number {
  return left + ((value - domain[0]) / (domain[1] - domain[0])) * width;
}

function sampleLabel(index: number): string {
  let current = index;
  let label = '';
  do {
    label = String.fromCharCode(97 + (current % 26)) + label;
    current = Math.floor(current / 26) - 1;
  } while (current >= 0);
  return label;
}

function finiteDomainData(data: readonly XYPoint[] | undefined, domain: readonly [number, number]): XYPoint[] {
  return (data ?? []).filter((point) => Number.isFinite(point.x)
    && Number.isFinite(point.y)
    && point.x >= domain[0]
    && point.x <= domain[1]);
}

function downsample(data: readonly XYPoint[], maximum = 4500): readonly XYPoint[] {
  if (data.length <= maximum) return data;
  const step = Math.ceil(data.length / maximum);
  const sampled = data.filter((_, index) => index % step === 0);
  const last = data.at(-1)!;
  if (sampled.at(-1) !== last) sampled.push(last);
  return sampled;
}

function curvePath(
  data: readonly XYPoint[],
  domain: readonly [number, number],
  plot: Frame,
  baselineY: number,
  amplitude: number,
): string {
  if (data.length < 2) return '';
  const intensities = data.map((point) => point.y);
  const low = quantile(intensities, 0.01);
  const high = Math.max(...intensities);
  const span = high > low ? high - low : 1;
  return downsample(data).map((point, index) => {
    const relative = Math.max(-0.08, Math.min(1, (point.y - low) / span));
    const x = xPosition(point.x, domain, plot.x, plot.width);
    const y = baselineY - relative * amplitude;
    return `${index ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(' ');
}

function renderXAxis(panel: Panel, plot: Frame): string {
  const [minimum, maximum] = panel.xDomain;
  const ticks: string[] = [];
  for (let value = Math.ceil(minimum); value <= Math.floor(maximum); value += 1) {
    const x = xPosition(value, panel.xDomain, plot.x, plot.width);
    const major = value % 2 === 0;
    ticks.push(`<line x1="${number(x)}" y1="${number(plot.y + plot.height)}" x2="${number(x)}" y2="${number(plot.y + plot.height + (major ? 13 : 7))}" stroke="#111" stroke-width="${major ? 4 : 2}"/>`);
    if (major) ticks.push(`<text x="${number(x)}" y="${number(plot.y + plot.height + 38)}" text-anchor="middle" class="tick">${value}</text>`);
  }
  return ticks.join('');
}

function renderGuides(panel: Panel, plot: Frame, wavelength: number): string {
  return panel.guides.map((guide) => {
    const twoTheta = dToTwoTheta(guide.d, wavelength);
    if (twoTheta < panel.xDomain[0] || twoTheta > panel.xDomain[1]) return '';
    const x = xPosition(twoTheta, panel.xDomain, plot.x, plot.width);
    const labelY = plot.y - 16 - (guide.level ?? 0) * 58;
    return `<g class="guide"><line x1="${number(x)}" y1="${number(plot.y)}" x2="${number(x)}" y2="${number(plot.y + plot.height)}"/><text x="${number(x)}" y="${number(labelY)}" dominant-baseline="middle" transform="rotate(-90 ${number(x)} ${number(labelY)})">${guide.label}</text></g>`;
  }).join('');
}

function renderCurves(panel: Panel, plot: Frame, samples: readonly SampleState[]): string {
  const spacing = plot.height / (samples.length + 0.9);
  const amplitude = spacing * 1.08;
  const curves = samples.map((sample, index) => {
    const data = finiteDomainData(panel.data(sample), panel.xDomain);
    const baselineY = plot.y + spacing * (index + 1.22);
    const path = curvePath(data, panel.xDomain, plot, baselineY, amplitude);
    if (!path) return '';
    const color = CURVE_COLORS[index % CURVE_COLORS.length];
    const labelY = baselineY + 8;
    return `<path d="${path}" fill="none" stroke="${color}" stroke-width="2.15" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/><text x="${number(plot.x + plot.width + 14)}" y="${number(labelY)}" class="sample-label">${sampleLabel(index)}</text>`;
  }).join('');
  if (curves) return curves;
  return `<text x="${number(plot.x + plot.width / 2)}" y="${number(plot.y + plot.height / 2)}" text-anchor="middle" class="empty">${panel.emptyText}</text>`;
}

function renderPanel(panel: Panel, samples: readonly SampleState[], wavelength: number): string {
  const plot: Frame = {
    x: panel.frame.x + 94,
    y: panel.frame.y + 150,
    width: panel.frame.width - 142,
    height: panel.frame.height - 250,
  };
  return `<g id="${panel.id}">
    <title>${panel.label}</title>
    <rect x="${panel.frame.x}" y="${panel.frame.y}" width="${panel.frame.width}" height="${panel.frame.height}" class="panel"/>
    ${renderGuides(panel, plot, wavelength)}
    <g clip-path="url(#clip-${panel.id})">${renderCurves(panel, plot, samples)}</g>
    <path d="M${plot.x} ${plot.y}V${plot.y + plot.height}H${plot.x + plot.width}" class="axis"/>
    ${renderXAxis(panel, plot)}
    <text x="${number(plot.x + plot.width / 2)}" y="${number(plot.y + plot.height + 76)}" text-anchor="middle" class="axis-title axis-title--x">θ/2θ (градусы)</text>
    <text x="${number(panel.frame.x + 35)}" y="${number(plot.y + plot.height / 2)}" text-anchor="middle" transform="rotate(-90 ${number(panel.frame.x + 35)} ${number(plot.y + plot.height / 2)})" class="axis-title">Интенсивность (имп. в сек.)</text>
  </g>`;
}

export function buildDiffractogramSvg(samples: readonly SampleState[]): string {
  const wavelength = samples[0]?.wavelength ?? 1.5406;
  const basePanels: readonly Panel[] = [
    {
      id: 'air-dry',
      label: 'VS',
      frame: { x: 35, y: 25, width: 1430, height: 1085 },
      xDomain: [2, 30],
      guides: AIR_DRY_GUIDES,
      data: (sample) => sample.rawVsData,
      emptyText: 'Нет данных воздушно-сухого препарата',
    },
    {
      id: 'glycol',
      label: 'GL',
      frame: { x: 35, y: 1160, width: 700, height: 1165 },
      xDomain: [2, 15],
      guides: GL_GUIDES,
      data: (sample) => sample.rawGlData,
      emptyText: 'Нет данных насыщенного препарата',
    },
    {
      id: 'heated',
      label: 'PK',
      frame: { x: 765, y: 1160, width: 700, height: 1165 },
      xDomain: [2, 15],
      guides: PK_GUIDES,
      data: (sample) => sample.rawPkData,
      emptyText: 'PK не загружен',
    },
  ];
  const extraSources: readonly Pick<Panel, 'id' | 'label' | 'data' | 'emptyText'>[] = [
    { id: 'tp', label: 'TP', data: (sample) => sample.rawTpData, emptyText: 'TP не загружен' },
    { id: 'sp', label: 'SP', data: (sample) => sample.rawSpData, emptyText: 'SP не загружен' },
    { id: 'ost', label: 'OST', data: (sample) => sample.rawOstData, emptyText: 'OST не загружен' },
  ];
  const extraPanels: readonly Panel[] = extraSources
    .filter((source) => samples.some((sample) => source.data(sample)?.length))
    .map((source, index) => ({
      ...source,
      frame: {
        x: 35,
        y: BASE_SVG_HEIGHT + 15 + index * (FULL_PANEL_HEIGHT + FULL_PANEL_GAP),
        width: 1430,
        height: FULL_PANEL_HEIGHT,
      },
      xDomain: [2, 30] as const,
      guides: AIR_DRY_GUIDES,
    }));
  const panels: readonly Panel[] = [...basePanels, ...extraPanels];
  const svgHeight = extraPanels.length
    ? extraPanels.at(-1)!.frame.y + FULL_PANEL_HEIGHT + 35
    : BASE_SVG_HEIGHT;
  const clipPaths = panels.map((panel) => {
    const plot = { x: panel.frame.x + 94, y: panel.frame.y + 150, width: panel.frame.width - 142, height: panel.frame.height - 250 };
    return `<clipPath id="clip-${panel.id}"><rect x="${plot.x}" y="${plot.y}" width="${plot.width + 45}" height="${plot.height}"/></clipPath>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_WIDTH}" height="${svgHeight}" viewBox="0 0 ${SVG_WIDTH} ${svgHeight}" role="img" aria-labelledby="title description">
  <title id="title">Дифрактограммы образцов</title>
  <desc id="description">Серии VS, GL, PK, TP, SP и OST</desc>
  <defs>
    ${clipPaths}
    <style>
      text { font-family: Arial, Helvetica, sans-serif; fill: #202020; }
      .panel { fill: #fff; stroke: #d2d2d2; stroke-width: 1.5; }
      .axis { fill: none; stroke: #111; stroke-width: 5; stroke-linecap: square; }
      .tick { font-size: 21px; }
      .axis-title { font-size: 23px; font-style: italic; }
      .axis-title--x { font-size: 24px; }
      .guide line { stroke: #c8c8c8; stroke-width: 4; stroke-dasharray: 4 10; }
      .guide text { font-size: 31px; }
      .sample-label { font-size: 32px; }
      .empty { fill: #777; font-size: 22px; }
    </style>
  </defs>
  <rect width="${SVG_WIDTH}" height="${svgHeight}" fill="#fff"/>
  ${panels.map((panel) => renderPanel(panel, samples, wavelength)).join('\n  ')}
</svg>`;
}

export function exportDiffractogramSvg(samples: readonly SampleState[], fileName = 'biscaye-graphs.svg'): void {
  const svg = buildDiffractogramSvg(samples);
  downloadBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), fileName);
}
