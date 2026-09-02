import { useEffect, useState } from 'react';

type Props = {
  availableRange: readonly [number, number];
  glFileCount: number;
  error?: string;
  onConfirm: (range: readonly [number, number]) => void;
  onCancel: () => void;
};

export function GlCropModal({ availableRange, glFileCount, error, onConfirm, onCancel }: Props) {
  const [startText, setStartText] = useState(String(availableRange[0]));
  const [endText, setEndText] = useState(String(availableRange[1]));
  const start = startText.trim() ? Number(startText) : Number.NaN;
  const end = endText.trim() ? Number(endText) : Number.NaN;
  const valid = Number.isFinite(start) && Number.isFinite(end)
    && start >= availableRange[0] && end <= availableRange[1] && start < end;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  return (
    <div className="modal-backdrop">
      <section className="crop-modal" role="dialog" aria-modal="true" aria-labelledby="crop-modal-title">
        <header>
          <span className="sample-card__eyebrow">Импорт GL</span>
          <h2 id="crop-modal-title">Обрезка дифрактограмм</h2>
          <p>Укажите рабочие границы по оси 2θ перед созданием карточек.</p>
        </header>
        <form onSubmit={(event) => { event.preventDefault(); if (valid) onConfirm([start, end]); }}>
          <div className="crop-modal__fields">
            <label>Начало, ° 2θ<input autoFocus type="number" min={availableRange[0]} max={availableRange[1]} step="0.01" value={startText} onChange={(event) => setStartText(event.currentTarget.value)} /></label>
            <label>Конец, ° 2θ<input type="number" min={availableRange[0]} max={availableRange[1]} step="0.01" value={endText} onChange={(event) => setEndText(event.currentTarget.value)} /></label>
          </div>
          <p className="crop-modal__range">Доступно для всех GL: {availableRange[0].toLocaleString('ru-RU')}–{availableRange[1].toLocaleString('ru-RU')}° 2θ · файлов: {glFileCount}</p>
          {(!valid || error) && <p className="crop-modal__error" role="alert">{error ?? 'Начало должно быть меньше конца, обе границы — внутри доступного диапазона.'}</p>}
          <div className="crop-modal__actions">
            <button className="button" type="button" onClick={onCancel}>Отмена</button>
            <button className="button button--primary" type="submit" disabled={!valid}>Обрезать и загрузить</button>
          </div>
        </form>
      </section>
    </div>
  );
}
