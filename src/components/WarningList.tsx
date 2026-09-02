export function WarningList({ warnings }: { warnings: readonly string[] }) {
  if (!warnings.length) return <span className="status status--ok">Без предупреждений</span>;
  return (
    <ul className="warnings" aria-label="Предупреждения">
      {warnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}
    </ul>
  );
}
