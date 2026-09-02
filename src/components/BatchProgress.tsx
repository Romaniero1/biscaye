export type ProgressState = { current: number; total: number; active: boolean; warningCount?: number };

export function BatchProgress({ progress }: { progress: ProgressState | null }) {
  if (!progress) return null;
  const percent = progress.total ? (progress.current / progress.total) * 100 : 0;
  return (
    <div className="batch-progress" role="status" aria-live="polite">
      <div className="batch-progress__track"><span style={{ width: `${percent}%` }} /></div>
      <strong>{progress.current} / {progress.total}</strong>
      <span>{progress.active ? 'Выполняется фитинг…' : `Готово${progress.warningCount ? ` · с предупреждениями: ${progress.warningCount}` : ''}`}</span>
    </div>
  );
}
