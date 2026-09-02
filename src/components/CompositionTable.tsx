import type { SampleState } from '../xrd/types';

function percent(value: number | null): string {
  return value === null || !Number.isFinite(value) ? '—' : value.toFixed(2);
}

export function CompositionTable({ sample }: { sample: SampleState }) {
  const { result } = sample;
  const split = result.chlorite !== null && result.kaolinite !== null;
  const rows = split
    ? [['Smectite + I/S', result.smectiteIS], ['Illite', result.illite], ['Chlorite', result.chlorite], ['Kaolinite', result.kaolinite]] as const
    : [['Smectite + I/S', result.smectiteIS], ['Illite', result.illite], ['Chlorite + Kaolinite', result.chloriteKaolinite]] as const;
  return (
    <section className="data-section composition-section">
      <h3>Количественный состав</h3>
      <table className="composition-table">
        <thead><tr><th>Фаза</th><th>Содержание, %</th></tr></thead>
        <tbody>
          {rows.map(([label, value]) => <tr key={label}><td>{label}</td><td>{percent(value)}</td></tr>)}
          <tr className="table-total"><td>Сумма</td><td>{percent(result.total)}</td></tr>
        </tbody>
      </table>
    </section>
  );
}
