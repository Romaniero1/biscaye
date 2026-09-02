import type { BackgroundPoint, ReflectionKey, SampleState, XYPoint } from '../xrd/types';
import { GlDiffractogram } from './GlDiffractogram';
import { VsDoubletView } from './VsDoubletView';
import { WarningList } from './WarningList';
import { ReflectionTable } from './ReflectionTable';
import { CompositionTable } from './CompositionTable';

type SampleCardProps = {
  sample: SampleState;
  expanded: boolean;
  onToggle: () => void;
  onMarkerMove: (sampleId: string, key: ReflectionKey, center: number) => void;
  onBackgroundMove: (sampleId: string, point: BackgroundPoint) => void;
  onBackgroundAdd: (sampleId: string, point: XYPoint) => void;
  onFit: () => void;
  onReset: () => void;
};

export function SampleCard({ sample, expanded, onToggle, onMarkerMove, onBackgroundMove, onBackgroundAdd, onFit, onReset }: SampleCardProps) {
  const bodyId = `sample-card-body-${sample.id}`;
  const canFit = sample.backgroundPoints.length >= 3 && sample.backgroundCurve.length > 0;
  const auxiliaryFiles = [
    { code: 'PK', fileName: sample.pkFileName },
    { code: 'TP', fileName: sample.tpFileName },
    { code: 'SP', fileName: sample.spFileName },
    { code: 'OST', fileName: sample.ostFileName },
  ] as const;
  return (
    <article className="sample-card">
      <header className="sample-card__header">
        <div className="sample-card__identity">
          <span className="sample-card__eyebrow">Образец</span>
          <div className="sample-card__title-row">
            <h2>{sample.sampleId}</h2>
            <span className="sample-card__file-badges">
              {auxiliaryFiles.map(({ code, fileName }) => fileName ? (
                <span key={code} className="sample-card__file-badge" title={`Загружен: ${fileName}`} aria-label={`${code} загружен: ${fileName}`}>
                  <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3.5 8 3 3 6-6" /></svg>
                  {code}
                </span>
              ) : null)}
            </span>
          </div>
          <p>{sample.glFileName}{sample.vsFileName ? ` · ${sample.vsFileName}` : ''}</p>
        </div>
        <div className="sample-card__actions">
          <WarningList warnings={sample.warnings} />
          <div className="local-actions"><button className="button button--small" disabled={!canFit} title={!canFit ? 'Сначала уточните фон' : undefined} onClick={onFit}>Фитинг</button><button className="button button--small" onClick={onReset}>Сбросить</button></div>
          <button className={`sample-card__toggle${expanded ? '' : ' sample-card__toggle--collapsed'}`} type="button" aria-expanded={expanded} aria-controls={bodyId} aria-label={`${expanded ? 'Свернуть' : 'Развернуть'} образец ${sample.sampleId}`} onClick={onToggle}>
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 7.5 5 5 5-5" /></svg>
          </button>
        </div>
      </header>
      <div id={bodyId} hidden={!expanded}>
        <div className="sample-card__plots">
          <GlDiffractogram sample={sample} onMarkerMove={(key, center) => onMarkerMove(sample.id, key, center)} onBackgroundMove={(point) => onBackgroundMove(sample.id, point)} onBackgroundAdd={(point) => onBackgroundAdd(sample.id, point)} />
          <VsDoubletView sample={sample} onMarkerMove={(key, center) => onMarkerMove(sample.id, key, center)} />
        </div>
        <div className="sample-card__tables">
          <ReflectionTable sample={sample} />
          <CompositionTable sample={sample} />
        </div>
      </div>
    </article>
  );
}
