import { useMemo } from 'react';
import { vsDoubletWindow } from '../xrd/baseline';
import type { SampleState } from '../xrd/types';
import type { VsReflectionKey } from '../xrd/types';
import { VS_REFLECTIONS } from '../xrd/peaks';
import { Chart } from './Chart';
import { PeakMarker } from './PeakMarker';

export function getVsDomain(wavelength: number): [number, number] {
  return vsDoubletWindow(wavelength);
}

export function VsDoubletView({ sample, onMarkerMove }: { sample: SampleState; onMarkerMove: (key: VsReflectionKey, center: number) => void }) {
  const domain = getVsDomain(sample.wavelength);
  const series = useMemo(() => {
    if (!sample.rawVsData) return [];
    const baseline = sample.vsBaseline
      ? [{ x: domain[0], y: sample.vsBaseline.slope * domain[0] + sample.vsBaseline.intercept }, { x: domain[1], y: sample.vsBaseline.slope * domain[1] + sample.vsBaseline.intercept }]
      : [];
    return [
      { id: 'vs', points: sample.rawVsData, color: '#4057a1' },
      ...(baseline.length ? [{ id: 'vs-baseline', points: baseline, color: '#d07131', width: 1.5, dash: '5 4' }] : []),
    ];
  }, [domain, sample.rawVsData, sample.vsBaseline]);
  return (
    <section className="plot-panel plot-panel--vs">
      <div className="plot-panel__heading"><strong>Воздушно-сухой препарат</strong></div>
      <Chart series={series} xDomain={domain} height={320} emptyText="VS не найден" axisTextScale={1.7}>
        {(Object.keys(VS_REFLECTIONS) as VsReflectionKey[]).map((key) => {
          const reflection = sample.reflections[key];
          const dValue = reflection && Number.isFinite(reflection.dAngstrom) ? reflection.dAngstrom.toFixed(2) : '—';
          const label = VS_REFLECTIONS[key].markerLabel.replace(' ', '');
          return reflection ? <PeakMarker key={key} x={reflection.center2Theta} xDomain={domain} chartHeight={320} label={label} secondaryLabel={`${dValue} Å`} labelWidth={86} labelHeight={42} labelFontSize={15} color="#4057a1" onCommit={(center) => onMarkerMove(key, center)} /> : null;
        })}
      </Chart>
    </section>
  );
}
