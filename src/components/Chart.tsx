import { Fragment, useMemo } from 'react';
import type { XYPoint } from '../xrd/types';
import { interpolateY } from '../xrd/math/statistics';

export type ChartSeries = {
  id: string;
  points: readonly XYPoint[];
  color: string;
  width?: number;
  dash?: string;
  onDoubleClick?: (point: XYPoint) => void;
  interactiveLabel?: string;
};

type ChartProps = {
  series: readonly ChartSeries[];
  xDomain: readonly [number, number];
  yDomain?: readonly [number, number];
  height?: number;
  emptyText?: string;
  axisTextScale?: number;
  xTickStep?: number;
  xGridStep?: number;
  children?: React.ReactNode;
};

export const CHART_BOX = { left: 54, right: 14, top: 54, bottom: 38, width: 800 } as const;

function formatIntensityTick(value: number): string {
  const absolute = Math.abs(value);
  const maximumFractionDigits = absolute >= 10 ? 0 : absolute >= 1 ? 1 : 2;
  return value.toLocaleString('ru-RU', { useGrouping: false, maximumFractionDigits });
}

function steppedTicks(domain: readonly [number, number], step: number): number[] {
  if (!(step > 0) || !Number.isFinite(step)) return [];
  const first = Math.ceil((domain[0] - Number.EPSILON) / step) * step;
  const ticks: number[] = [];
  for (let value = first; value <= domain[1] + Number.EPSILON; value += step) ticks.push(Number(value.toFixed(10)));
  return ticks;
}

export function downsample(points: readonly XYPoint[], maxPoints = 1400): readonly XYPoint[] {
  if (points.length <= maxPoints) return points;
  const stride = Math.ceil(points.length / maxPoints);
  const sampled: XYPoint[] = [];
  for (let index = 0; index < points.length; index += stride) sampled.push(points[index]);
  if (sampled.at(-1) !== points.at(-1)) sampled.push(points.at(-1)!);
  return sampled;
}

export function getChartYDomain(series: readonly ChartSeries[], xDomain: readonly [number, number]): [number, number] {
  const values = series.flatMap((item) => downsample(item.points.filter((point) => point.x >= xDomain[0] && point.x <= xDomain[1])))
    .map((point) => point.y)
    .filter(Number.isFinite);
  const minimum = values.length ? Math.min(...values) : 0;
  const maximum = values.length ? Math.max(...values) : 1;
  const padding = Math.max((maximum - minimum) * 0.08, Math.abs(maximum) * 0.02, 1e-6);
  return [minimum - padding, maximum + padding];
}

export function Chart({ series, xDomain, yDomain: providedYDomain, height = 300, emptyText = 'Нет данных', axisTextScale = 1, xTickStep, xGridStep, children }: ChartProps) {
  const visible = useMemo(() => series.map((item) => ({
    ...item,
    points: downsample(item.points.filter((point) => point.x >= xDomain[0] && point.x <= xDomain[1])),
  })), [series, xDomain]);
  const allPoints = visible.flatMap((item) => item.points);
  const yDomain = providedYDomain ?? getChartYDomain(series, xDomain);
  const plotWidth = CHART_BOX.width - CHART_BOX.left - CHART_BOX.right;
  const plotHeight = height - CHART_BOX.top - CHART_BOX.bottom;
  const xScale = (x: number) => CHART_BOX.left + ((x - xDomain[0]) / (xDomain[1] - xDomain[0])) * plotWidth;
  const yScale = (y: number) => CHART_BOX.top + (1 - (y - yDomain[0]) / (yDomain[1] - yDomain[0])) * plotHeight;
  const path = (points: readonly XYPoint[]) => points.map((point, index) => `${index ? 'L' : 'M'}${xScale(point.x).toFixed(2)},${yScale(point.y).toFixed(2)}`).join(' ');
  const xTicks = xTickStep ? steppedTicks(xDomain, xTickStep) : Array.from({ length: 6 }, (_, index) => xDomain[0] + (index / 5) * (xDomain[1] - xDomain[0]));
  const xGridTicks = xGridStep ? steppedTicks(xDomain, xGridStep) : xTicks;
  const yTicks = Array.from({ length: 4 }, (_, index) => yDomain[0] + (index / 3) * (yDomain[1] - yDomain[0]));

  return (
    <svg className="chart" viewBox={`0 0 ${CHART_BOX.width} ${height}`} role="img">
      <rect x={CHART_BOX.left} y={CHART_BOX.top} width={plotWidth} height={plotHeight} className="chart__plot" />
      {xGridTicks.map((tick) => <line key={`x-grid-${tick}`} x1={xScale(tick)} x2={xScale(tick)} y1={CHART_BOX.top} y2={height - CHART_BOX.bottom} className="chart__grid" />)}
      {xTicks.map((tick) => <text key={`x-tick-${tick}`} x={xScale(tick)} y={height - 16} textAnchor="middle" className="chart__tick" style={{ fontSize: 10 * axisTextScale }}>{xTickStep && Number.isInteger(xTickStep) ? tick.toFixed(0) : tick.toFixed(1)}</text>)}
      {yTicks.map((tick) => (
        <g key={tick}>
          <line x1={CHART_BOX.left} x2={CHART_BOX.width - CHART_BOX.right} y1={yScale(tick)} y2={yScale(tick)} className="chart__grid" />
          <text x={CHART_BOX.left - 8} y={yScale(tick) + 4} textAnchor="end" className="chart__tick" style={{ fontSize: 10 * axisTextScale }}>{formatIntensityTick(tick)}</text>
        </g>
      ))}
      {visible.map((item) => (
        <Fragment key={item.id}>
          <path d={path(item.points)} fill="none" stroke={item.color} strokeWidth={item.width ?? 1.6} strokeDasharray={item.dash} vectorEffect="non-scaling-stroke" pointerEvents="none" />
          {item.onDoubleClick && item.points.length > 1 && <path
            d={path(item.points)}
            fill="none"
            stroke="transparent"
            strokeWidth={14}
            className="chart__interactive-line"
            onDoubleClick={(event) => {
              const svg = event.currentTarget.ownerSVGElement;
              if (!svg) return;
              const rect = svg.getBoundingClientRect();
              const svgX = ((event.clientX - rect.left) / rect.width) * CHART_BOX.width;
              const x = Math.max(xDomain[0], Math.min(xDomain[1], xDomain[0] + ((svgX - CHART_BOX.left) / plotWidth) * (xDomain[1] - xDomain[0])));
              item.onDoubleClick?.({ x, y: interpolateY(item.points, x) });
            }}
          >
            {item.interactiveLabel && <title>{item.interactiveLabel}</title>}
          </path>}
        </Fragment>
      ))}
      {!allPoints.length && <text x={CHART_BOX.width / 2} y={height / 2} textAnchor="middle" className="chart__empty">{emptyText}</text>}
      <text x={CHART_BOX.left + plotWidth / 2} y={height - 3} textAnchor="middle" className="chart__axis-label" style={{ fontSize: 11 * axisTextScale }}>2θ, °</text>
      {children}
    </svg>
  );
}
