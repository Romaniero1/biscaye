import { useEffect, useState } from 'react';
import { CHART_BOX } from './Chart';

type PeakMarkerProps = {
  x: number;
  xDomain: readonly [number, number];
  chartHeight: number;
  label: string;
  secondaryLabel?: string;
  color?: string;
  labelWidth?: number;
  labelHeight?: number;
  labelFontSize?: number;
  onCommit: (x: number) => void;
};

export function PeakMarker({ x, xDomain, chartHeight, label, secondaryLabel, color = '#b23a48', labelWidth = 50, labelHeight = 17, labelFontSize = 9, onCommit }: PeakMarkerProps) {
  const [dragX, setDragX] = useState(x);
  const [dragging, setDragging] = useState(false);
  useEffect(() => { if (!dragging) setDragX(x); }, [dragging, x]);
  const plotWidth = CHART_BOX.width - CHART_BOX.left - CHART_BOX.right;
  const scaledX = CHART_BOX.left + ((dragX - xDomain[0]) / (xDomain[1] - xDomain[0])) * plotWidth;
  const labelY = CHART_BOX.top - labelHeight - 4;

  const pointerToX = (event: React.PointerEvent<SVGGElement>) => {
    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return dragX;
    const rect = svg.getBoundingClientRect();
    const svgX = ((event.clientX - rect.left) / rect.width) * CHART_BOX.width;
    const value = xDomain[0] + ((svgX - CHART_BOX.left) / plotWidth) * (xDomain[1] - xDomain[0]);
    return Math.max(xDomain[0], Math.min(xDomain[1], value));
  };

  return (
    <g
      className={`peak-marker${dragging ? ' peak-marker--dragging' : ''}`}
      onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setDragging(true); setDragX(pointerToX(event)); }}
      onPointerMove={(event) => { if (dragging) setDragX(pointerToX(event)); }}
      onPointerUp={(event) => { const next = pointerToX(event); setDragX(next); setDragging(false); onCommit(next); }}
      onPointerCancel={() => { setDragging(false); setDragX(x); }}
    >
      <line x1={scaledX} x2={scaledX} y1={CHART_BOX.top} y2={chartHeight - CHART_BOX.bottom} stroke={color} strokeWidth={dragging ? 2.5 : 1.5} vectorEffect="non-scaling-stroke" />
      <rect x={scaledX - labelWidth / 2} y={labelY} width={labelWidth} height={labelHeight} rx={4} fill={color} />
      <text x={scaledX} y={labelY + labelHeight * (secondaryLabel ? 0.38 : 0.72)} textAnchor="middle" className="peak-marker__label" style={{ fontSize: labelFontSize }}>
        <tspan x={scaledX}>{label}</tspan>
        {secondaryLabel && <tspan x={scaledX} dy={labelFontSize * 0.95}>{secondaryLabel}</tspan>}
      </text>
    </g>
  );
}
