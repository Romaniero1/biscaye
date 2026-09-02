import { useMemo, useState } from 'react';
import type { GlReflectionKey, SampleState, XYPoint } from '../xrd/types';
import { GL_REFLECTIONS } from '../xrd/peaks';
import { evaluatePeak } from '../xrd/peaks';
import { buildRefinedBackground, smoothBackgroundValue } from '../xrd/baseline';
import { Chart, getChartYDomain } from './Chart';
import { PeakMarker } from './PeakMarker';
import { BackgroundControlPoint } from './BackgroundControlPoint';
import type { BackgroundPoint } from '../xrd/types';

type Props = {
  sample: SampleState;
  onMarkerMove: (key: GlReflectionKey, center: number) => void;
  onBackgroundMove: (point: BackgroundPoint) => void;
  onBackgroundAdd: (point: XYPoint) => void;
};

export function GlDiffractogram({ sample, onMarkerMove, onBackgroundMove, onBackgroundAdd }: Props) {
  const xDomain = sample.glCropRange;
  const [previewPoint, setPreviewPoint] = useState<BackgroundPoint | null>(null);
  const activeBackgroundPoints = useMemo(() => previewPoint
    ? sample.backgroundPoints.map((point) => point.id === previewPoint.id ? previewPoint : point).sort((a, b) => a.x - b.x)
    : sample.backgroundPoints,
  [previewPoint, sample.backgroundPoints]);
  const activeBackgroundCurve = useMemo(() => previewPoint
    ? buildRefinedBackground(sample.processedGlData, activeBackgroundPoints)
    : sample.backgroundCurve,
  [activeBackgroundPoints, previewPoint, sample.backgroundCurve, sample.processedGlData]);
  const series = useMemo(() => {
    const visible = sample.processedGlData.filter((point) => point.x >= xDomain[0] && point.x <= xDomain[1]);
    const initial = visible.length ? [{ x: visible[0].x, y: 0 }, { x: visible.at(-1)!.x, y: 0 }] : [];
    const fitted = GL_REFLECTIONS.flatMap((definition) => {
      const fit = sample.reflections[definition.key];
      if (!fit?.converged || !fit.fwhm) return [];
      const fwhm = fit.fwhm;
      const componentPoints = visible
        .filter((point) => Math.abs(point.x - fit.center2Theta) <= fwhm * 2.6)
        .map((point) => ({ x: point.x, y: evaluatePeak(fit, point.x) }));
      const totalPoints = componentPoints.map((point) => ({ x: point.x, y: point.y + (sample.backgroundPoints.length ? smoothBackgroundValue(sample.backgroundPoints, point.x) : 0) }));
      return [
        { id: `component-${definition.key}`, points: componentPoints, color: '#58aaa6', width: 1.3, dash: '4 3' },
        { id: `fit-${definition.key}`, points: totalPoints, color: '#0f8c86', width: 2.2 },
      ];
    });
    return [
      { id: 'experiment', points: sample.processedGlData, color: '#22313f' },
      { id: 'initial-baseline', points: initial, color: '#9aa7ae', width: 1, dash: '5 4' },
      ...(activeBackgroundCurve.length ? [{
        id: 'refined-background',
        points: activeBackgroundCurve,
        color: '#d07131',
        width: 2,
        onDoubleClick: onBackgroundAdd,
        interactiveLabel: 'Двойной щелчок — добавить точку фона',
      }] : []),
      ...fitted,
    ];
  }, [activeBackgroundCurve, onBackgroundAdd, sample.backgroundPoints, sample.processedGlData, sample.reflections, xDomain]);
  const yDomain = getChartYDomain(series.map((item) => item.id === 'refined-background' ? { ...item, points: sample.backgroundCurve } : item), xDomain);
  return (
    <section className="plot-panel plot-panel--gl">
      <div className="plot-panel__heading">
        <strong>Насыщенный препарат</strong>
      </div>
      <Chart series={series} xDomain={xDomain} yDomain={yDomain} height={320} xTickStep={1} xGridStep={3}>
        {GL_REFLECTIONS.map((definition) => {
          const reflection = sample.reflections[definition.key];
          const label = reflection && Number.isFinite(reflection.dAngstrom) ? `${reflection.dAngstrom.toFixed(1)} Å` : definition.markerLabel;
          return reflection ? <PeakMarker key={definition.key} x={reflection.center2Theta} xDomain={xDomain} chartHeight={320} label={label} onCommit={(center) => onMarkerMove(definition.key, center)} /> : null;
        })}
        {sample.backgroundPoints.map((point, index) => {
          const previous = sample.backgroundPoints[index - 1];
          const next = sample.backgroundPoints[index + 1];
          const epsilon = 0.01;
          return <BackgroundControlPoint key={point.id} point={point} xDomain={xDomain} xBounds={[previous ? previous.x + epsilon : xDomain[0], next ? next.x - epsilon : xDomain[1]]} yDomain={yDomain} chartHeight={320} onPreview={setPreviewPoint} onCommit={onBackgroundMove} />;
        })}
      </Chart>
    </section>
  );
}
