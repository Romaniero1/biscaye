import { useRef, useState } from 'react';
import { VirtualizedSampleList } from './components/VirtualizedSampleList';
import { BatchProgress, type ProgressState } from './components/BatchProgress';
import { GlCropModal } from './components/GlCropModal';
import { parseXrdText, SUPPORTED_EXTENSIONS } from './xrd/parsers';
import { createEmptyProject, createSampleState, deserializeProject, pairXrdFiles, serializeProject, type LoadedXrdFile } from './xrd/project';
import { initializeBaselines, refineSampleBackground } from './xrd/processing/initializeBaselines';
import { initializePeaks } from './xrd/processing/initializePeaks';
import { moveDetectedMarker } from './xrd/peaks';
import type { ReflectionKey } from './xrd/types';
import type { BackgroundPoint, FitModel, GlReflectionKey, SampleState, XYPoint } from './xrd/types';
import { fitSamplePeaks } from './xrd/processing/fitSample';
import { calculateSample } from './xrd/biscaye';
import { addBackgroundPointAndRefit, moveBackgroundAndRefit, refitMovedGlMarker } from './xrd/processing/reactiveProcessing';
import { resetSampleProcessing } from './xrd/processing/resetProcessing';
import { twoThetaToD } from './xrd/physics/bragg';
import { buildProjectFileName, downloadBlob, exportDiffractogramSvg, exportXlsx } from './xrd/export';
import type { ProjectState } from './xrd/types';
import { cropGlData } from './xrd/processing/cropGlData';

const ACCEPT = SUPPORTED_EXTENSIONS.map((extension) => `.${extension}`).join(',');

type PendingImport = {
  loaded: LoadedXrdFile[];
  errors: string[];
  availableRange: readonly [number, number];
  glFileCount: number;
};

function hasRefinedBackground(sample: SampleState): boolean {
  return sample.backgroundPoints.length >= 3 && sample.backgroundCurve.length > 0;
}

export function App() {
  const [project, setProject] = useState<ProjectState>(createEmptyProject);
  const [messages, setMessages] = useState<string[]>([]);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  const [cropError, setCropError] = useState<string>();
  const inputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);
  const backgroundsReady = project.samples.length > 0 && project.samples.every(hasRefinedBackground);
  const fittingComplete = project.samples.length > 0 && project.samples.every((sample) => sample.fitted);
  const hasProjectName = project.name.trim().length > 0;
  const projectActionsDisabled = !project.samples.length || !hasProjectName;

  async function loadFiles(files: FileList | null) {
    if (!files?.length) return;
    const loaded: LoadedXrdFile[] = [];
    const errors: string[] = [];
    await Promise.all([...files].map(async (file) => {
      try {
        loaded.push({ fileName: file.name, parsed: parseXrdText(file.name, await file.text()) });
      } catch (error) {
        errors.push(`${file.name}: ${error instanceof Error ? error.message : 'Не удалось распознать формат файла'}`);
      }
    }));
    const pairs = pairXrdFiles(loaded);
    const missingGl = pairs.filter((pair) => !pair.gl).map((pair) => `${pair.sampleId}: GL не найден`);
    const unclassified = loaded.filter((file) => !pairs.some((pair) => pair.gl === file || pair.vs === file || pair.pk === file || pair.tp === file || pair.sp === file || pair.ost === file)).map((file) => `${file.fileName}: имя не содержит токен GL, VS, PK, TP, SP или OST`);
    const glFiles = pairs.flatMap((pair) => pair.gl ? [pair.gl] : []);
    if (!glFiles.length) {
      setMessages([...errors, ...missingGl, ...unclassified, 'GL-файлы для загрузки не найдены']);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    const starts = glFiles.map((file) => file.parsed.points[0]?.x ?? Number.POSITIVE_INFINITY);
    const ends = glFiles.map((file) => file.parsed.points.at(-1)?.x ?? Number.NEGATIVE_INFINITY);
    const availableRange: readonly [number, number] = [Math.max(2, ...starts), Math.min(15, ...ends)];
    if (!(availableRange[0] < availableRange[1])) {
      setMessages([...errors, 'У GL-файлов нет общего диапазона внутри 2–15° 2θ']);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    setCropError(undefined);
    setPendingImport({ loaded, errors, availableRange, glFileCount: glFiles.length });
    if (inputRef.current) inputRef.current.value = '';
  }

  function confirmImport(range: readonly [number, number]) {
    if (!pendingImport) return;
    const pairs = pairXrdFiles(pendingImport.loaded);
    const invalid = pairs.filter((pair) => pair.gl && cropGlData(pair.gl.parsed.points, range).length < 7);
    if (invalid.length) {
      setCropError(`Недостаточно GL-точек в выбранном диапазоне: ${invalid.map((pair) => pair.sampleId).join(', ')}`);
      return;
    }
    const samples = pairs
      .map((pair) => createSampleState(pair, project.settings.wavelength, range))
      .filter((sample) => sample !== null)
      .map(initializeBaselines)
      .map((sample) => initializePeaks(sample, project.settings.fitModel));
    const missingGl = pairs.filter((pair) => !pair.gl).map((pair) => `${pair.sampleId}: GL не найден`);
    const unclassified = pendingImport.loaded.filter((file) => !pairs.some((pair) => pair.gl === file || pair.vs === file || pair.pk === file || pair.tp === file || pair.sp === file || pair.ost === file)).map((file) => `${file.fileName}: имя не содержит токен GL, VS, PK, TP, SP или OST`);
    setMessages([...pendingImport.errors, ...missingGl, ...unclassified]);
    setProject((current) => ({ ...current, samples }));
    setCropError(undefined);
    setPendingImport(null);
  }

  function moveMarker(sampleId: string, key: ReflectionKey, center: number) {
    setProject((current) => ({
      ...current,
      samples: current.samples.map((sample) => {
        if (sample.id !== sampleId) return sample;
        const moved = moveDetectedMarker(sample, key, center);
        return key === 'kaolinite_002' || key === 'chlorite_004'
          ? calculateSample(moved)
          : refitMovedGlMarker(moved, key as GlReflectionKey, current.settings.fitModel);
      }),
    }));
  }

  function moveBackground(sampleId: string, point: BackgroundPoint) {
    setProject((current) => ({ ...current, samples: current.samples.map((sample) => sample.id === sampleId ? moveBackgroundAndRefit(sample, point, current.settings.fitModel) : sample) }));
  }

  function addBackgroundPoint(sampleId: string, point: XYPoint) {
    setProject((current) => ({ ...current, samples: current.samples.map((sample) => sample.id === sampleId ? addBackgroundPointAndRefit(sample, point, current.settings.fitModel) : sample) }));
  }

  function fitOne(sampleId: string) {
    setProject((current) => ({ ...current, samples: current.samples.map((sample) => sample.id === sampleId && hasRefinedBackground(sample) ? fitSamplePeaks(sample, current.settings.fitModel, { optimizeCenters: true }) : sample) }));
  }

  function fitAll() {
    if (!backgroundsReady || progress?.active) return;
    const worker = new Worker(new URL('./workers/fit.worker.ts', import.meta.url), { type: 'module' });
    const warningSampleIds = new Set<string>();
    setProgress({ current: 0, total: project.samples.length, active: true });
    worker.onmessage = (event: MessageEvent<{ type: 'progress' | 'complete'; sample?: SampleState; current?: number; total: number }>) => {
      if (event.data.type === 'progress' && event.data.sample) {
        const completed = event.data.sample;
        if (completed.warnings.length) warningSampleIds.add(completed.id);
        setProject((current) => ({ ...current, samples: current.samples.map((sample) => sample.id === completed.id ? completed : sample) }));
        setProgress({ current: event.data.current ?? 0, total: event.data.total, active: true });
      } else {
        setProgress({ current: event.data.total, total: event.data.total, active: false, warningCount: warningSampleIds.size });
        worker.terminate();
      }
    };
    worker.onerror = () => {
      setMessages((current) => [...current, 'Пакетный фитинг завершился с ошибкой']);
      setProgress((current) => current ? { ...current, active: false } : null);
      worker.terminate();
    };
    worker.postMessage({ samples: project.samples, model: project.settings.fitModel });
  }

  function changeModel(model: FitModel) {
    setProject((current) => ({ ...current, settings: { ...current.settings, fitModel: model }, samples: current.samples.map((sample) => ({ ...sample, fitted: false })) }));
  }

  function resetOne(sampleId: string) {
    setProject((current) => ({ ...current, samples: current.samples.map((sample) => sample.id === sampleId ? resetSampleProcessing(sample, current.settings.wavelength, current.settings.fitModel) : sample) }));
  }

  function resetAll() {
    setProject((current) => ({ ...current, samples: current.samples.map((sample) => resetSampleProcessing(sample, current.settings.wavelength, current.settings.fitModel)) }));
    setProgress(null);
  }

  function recalculateAll() {
    if (!fittingComplete || progress?.active) return;
    setProject((current) => ({ ...current, samples: current.samples.map(calculateSample) }));
  }

  function changeWavelength(wavelength: number) {
    if (!(wavelength > 0) || !Number.isFinite(wavelength)) return;
    setProject((current) => ({
      ...current,
      settings: { ...current.settings, wavelength },
      samples: current.samples.map((sample) => {
        const reflections = Object.fromEntries(Object.entries(sample.reflections).map(([key, fit]) => [key, fit ? { ...fit, dAngstrom: twoThetaToD(fit.center2Theta, wavelength) } : fit]));
        const updated = initializeBaselines({ ...sample, wavelength, reflections });
        return sample.fitted ? fitSamplePeaks(updated, current.settings.fitModel) : calculateSample(updated);
      }),
    }));
  }

  function saveProject() {
    if (projectActionsDisabled) return;
    const fileName = buildProjectFileName(project.name, project.samples.length, 'PROJECT', 'xrd-biscaye.json');
    downloadBlob(new Blob([serializeProject(project)], { type: 'application/json;charset=utf-8' }), fileName);
  }

  async function openProject(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    try {
      const restored = deserializeProject(await file.text());
      setProject(restored);
      setMessages([]);
      setProgress(null);
    } catch (error) {
      setMessages([error instanceof Error ? error.message : 'Некорректный файл проекта']);
    } finally {
      if (projectInputRef.current) projectInputRef.current.value = '';
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="app-header__kicker">Локальная обработка XRD</p>
          <h1>Biscaye XRD</h1>
          <p>Пакетный анализ ориентированных препаратов глинистой фракции</p>
        </div>
        <div className="app-header__meta">
          <label className="project-name">
            <span className="visually-hidden">Название проекта</span>
            <input value={project.name} placeholder="Введите название проекта" onChange={(event) => setProject((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <div className="app-header__count"><strong>{project.samples.length}</strong><span>образцов</span></div>
        </div>
      </header>
      <nav className="toolbar" aria-label="Глобальные действия">
        <div className="toolbar__group">
          <button className="button button--primary" onClick={() => inputRef.current?.click()}>Загрузить</button>
          <input ref={inputRef} className="visually-hidden" type="file" accept={ACCEPT} multiple onChange={(event) => void loadFiles(event.target.files)} />
          <button className="button" disabled={!project.samples.length} onClick={() => setProject((current) => ({ ...current, samples: current.samples.map((sample) => { const refined = refineSampleBackground(sample, current.settings.backgroundPointCount); return sample.fitted ? fitSamplePeaks(refined, current.settings.fitModel) : refined; }) }))}>Уточнить фон</button>
          <button className="button" disabled={!backgroundsReady || progress?.active} title={!backgroundsReady && project.samples.length ? 'Сначала уточните фон' : undefined} onClick={fitAll}>Фитинг</button>
          <button className="button" disabled={!fittingComplete || progress?.active} title={!fittingComplete && project.samples.length ? 'Сначала выполните фитинг' : undefined} onClick={recalculateAll}>Пересчитать</button>
          <button className="button" disabled={!project.samples.length} onClick={resetAll}>Сбросить обработку</button>
        </div>
        <span className="toolbar__spacer" />
        <div className="toolbar__group">
          <button className="button" disabled={projectActionsDisabled} title={!hasProjectName && project.samples.length ? 'Введите название проекта' : undefined} onClick={saveProject}>Сохранить проект</button>
          <button className="button" onClick={() => projectInputRef.current?.click()}>Открыть проект</button>
          <input ref={projectInputRef} className="visually-hidden" type="file" accept=".json,.xrd-biscaye.json" onChange={(event) => void openProject(event.target.files)} />
          <button className="button" disabled={projectActionsDisabled} title={!hasProjectName && project.samples.length ? 'Введите название проекта' : undefined} onClick={() => void exportXlsx(project.samples, buildProjectFileName(project.name, project.samples.length, 'XLSX', 'xlsx'))}>XLSX</button>
          <button className="button" disabled={projectActionsDisabled} title={!hasProjectName && project.samples.length ? 'Введите название проекта' : undefined} onClick={() => exportDiffractogramSvg(project.samples, buildProjectFileName(project.name, project.samples.length, 'SVG', 'svg'))}>Графики</button>
        </div>
        <div className="toolbar__group toolbar__group--settings">
          <label className="compact-field">Модель<select value={project.settings.fitModel} onChange={(event) => changeModel(event.target.value as FitModel)}><option value="pearson-vii">Pearson VII</option><option value="gaussian">Gaussian</option></select></label>
          <label className="compact-field">Точек фона<select value={project.settings.backgroundPointCount} onChange={(event) => setProject((current) => ({ ...current, settings: { ...current.settings, backgroundPointCount: Number(event.target.value) } }))}>{[3, 4, 5, 6, 7].map((count) => <option key={count} value={count}>{count}</option>)}</select></label>
          <label className="compact-field">λ, Å<input key={project.settings.wavelength} defaultValue={project.settings.wavelength} min="0.01" step="0.0001" type="number" onBlur={(event) => changeWavelength(event.currentTarget.valueAsNumber)} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} /></label>
        </div>
      </nav>
      <BatchProgress progress={progress} />
      {messages.length > 0 && <div className="import-errors" role="alert">{messages.map((message) => <p key={message}>{message}</p>)}</div>}
      {project.samples.length
        ? <VirtualizedSampleList samples={project.samples} onMarkerMove={moveMarker} onBackgroundMove={moveBackground} onBackgroundAdd={addBackgroundPoint} onFitSample={fitOne} onResetSample={resetOne} />
        : <section className="empty-state"><h2>Загрузите серии съёмок воздушно-сухих и насыщенных образцов</h2><p>Поддерживаются DAT, TXT, XY и UXD</p><button className="button button--primary" onClick={() => inputRef.current?.click()}>Выбрать файлы</button></section>}
      {pendingImport && <GlCropModal availableRange={pendingImport.availableRange} glFileCount={pendingImport.glFileCount} error={cropError} onConfirm={confirmImport} onCancel={() => { setPendingImport(null); setCropError(undefined); }} />}
    </div>
  );
}
