import { useEffect, useState } from 'react';
import type { BackgroundPoint } from '../xrd/types';
import { CHART_BOX } from './Chart';

type Props = {
  point: BackgroundPoint;
  xDomain: readonly [number, number];
  xBounds: readonly [number, number];
  yDomain: readonly [number, number];
  chartHeight: number;
  onPreview: (point: BackgroundPoint | null) => void;
  onCommit: (point: BackgroundPoint) => void;
};

export function BackgroundControlPoint({ point, xDomain, xBounds, yDomain, chartHeight, onPreview, onCommit }: Props) {
  const [position, setPosition] = useState(point);
  const [dragging, setDragging] = useState(false);
  useEffect(() => { if (!dragging) setPosition(point); }, [dragging, point]);
  const plotWidth = CHART_BOX.width - CHART_BOX.left - CHART_BOX.right;
  const plotHeight = chartHeight - CHART_BOX.top - CHART_BOX.bottom;
  const scaledX = CHART_BOX.left + ((position.x - xDomain[0]) / (xDomain[1] - xDomain[0])) * plotWidth;
  const scaledY = CHART_BOX.top + (1 - (position.y - yDomain[0]) / (yDomain[1] - yDomain[0])) * plotHeight;

  const pointerToPoint = (event: React.PointerEvent<SVGCircleElement>): BackgroundPoint => {
    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return position;
    const rect = svg.getBoundingClientRect();
    const svgX = ((event.clientX - rect.left) / rect.width) * CHART_BOX.width;
    const svgY = ((event.clientY - rect.top) / rect.height) * chartHeight;
    const x = xDomain[0] + ((svgX - CHART_BOX.left) / plotWidth) * (xDomain[1] - xDomain[0]);
    const y = yDomain[1] - ((svgY - CHART_BOX.top) / plotHeight) * (yDomain[1] - yDomain[0]);
    return {
      id: point.id,
      x: Math.max(xBounds[0], Math.min(xBounds[1], x)),
      y: Math.max(yDomain[0], Math.min(yDomain[1], y)),
    };
  };

  return <circle
    className={`background-point${dragging ? ' background-point--dragging' : ''}`}
    cx={scaledX}
    cy={scaledY}
    r={dragging ? 7 : 5.5}
    onPointerDown={(event) => { const next = pointerToPoint(event); event.currentTarget.setPointerCapture(event.pointerId); setDragging(true); setPosition(next); onPreview(next); }}
    onPointerMove={(event) => { if (dragging) { const next = pointerToPoint(event); setPosition(next); onPreview(next); } }}
    onPointerUp={(event) => { const next = pointerToPoint(event); setPosition(next); setDragging(false); onPreview(null); onCommit(next); }}
    onPointerCancel={() => { setPosition(point); setDragging(false); onPreview(null); }}
  />;
}
