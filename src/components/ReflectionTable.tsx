import { GL_REFLECTIONS, VS_REFLECTIONS } from '../xrd/peaks';
import type { ReflectionKey, SampleState } from '../xrd/types';

function number(value: number | null | undefined, digits = 3): string {
  return value === null || value === undefined || !Number.isFinite(value) ? '—' : value.toFixed(digits);
}

export function ReflectionTable({ sample }: { sample: SampleState }) {
  const rows: Array<{ key: ReflectionKey; label: string; purpose: string; isVs?: boolean }> = [
    ...GL_REFLECTIONS.map((definition) => ({ key: definition.key, label: `GL, ${definition.markerLabel}`, purpose: definition.key === 'diagnostic_14' ? 'diagnostic' : definition.purpose })),
    { key: 'kaolinite_002', label: 'VS, K 002 ~3.57 Å', purpose: VS_REFLECTIONS.kaolinite_002.purpose, isVs: true },
    { key: 'chlorite_004', label: 'VS, Ch 004 ~3.54 Å', purpose: VS_REFLECTIONS.chlorite_004.purpose, isVs: true },
  ];
  return (
    <section className="data-section">
      <h3>Параметры рефлексов</h3>
      <div className="table-scroll">
        <table>
          <thead><tr><th>№</th><th>Рефлекс</th><th>2θ, °</th><th>d, Å</th><th>Интенсивность над фоном</th><th>Площадь</th><th>Фаза / назначение</th></tr></thead>
          <tbody>{rows.map((row, index) => {
            const fit = sample.reflections[row.key];
            const intensity = row.key === 'kaolinite_002' ? sample.vsIntensities?.kaolinite002 : row.key === 'chlorite_004' ? sample.vsIntensities?.chlorite004 : fit?.height;
            return <tr key={row.key}><td>{index + 1}</td><td>{row.label}</td><td>{number(fit?.center2Theta, 4)}</td><td>{number(fit?.dAngstrom, 4)}</td><td>{number(intensity)}</td><td>{row.isVs ? '—' : number(fit?.area)}</td><td>{row.purpose}</td></tr>;
          })}</tbody>
        </table>
      </div>
    </section>
  );
}
