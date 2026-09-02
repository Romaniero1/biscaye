import { useEffect, useRef, useState } from 'react';
import type { BackgroundPoint, SampleState, XYPoint } from '../xrd/types';
import type { ReflectionKey } from '../xrd/types';
import { SampleCard } from './SampleCard';

type ListProps = {
  samples: readonly SampleState[];
  onMarkerMove: (sampleId: string, key: ReflectionKey, center: number) => void;
  onBackgroundMove: (sampleId: string, point: BackgroundPoint) => void;
  onBackgroundAdd: (sampleId: string, point: XYPoint) => void;
  onFitSample: (sampleId: string) => void;
  onResetSample: (sampleId: string) => void;
};

function VirtualItem({ sample, onMarkerMove, onBackgroundMove, onBackgroundAdd, onFitSample, onResetSample }: Omit<ListProps, 'samples'> & { sample: SampleState }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [height, setHeight] = useState(450);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: '900px 0px' });
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !visible) return;
    const observer = new ResizeObserver(([entry]) => setHeight(Math.ceil(entry.contentRect.height)));
    observer.observe(host);
    return () => observer.disconnect();
  }, [visible]);

  return <div ref={hostRef} style={{ minHeight: visible ? undefined : height }}>{visible ? <SampleCard sample={sample} expanded={expanded} onToggle={() => setExpanded((current) => !current)} onMarkerMove={onMarkerMove} onBackgroundMove={onBackgroundMove} onBackgroundAdd={onBackgroundAdd} onFit={() => onFitSample(sample.id)} onReset={() => onResetSample(sample.id)} /> : null}</div>;
}

export function VirtualizedSampleList({ samples, onMarkerMove, onBackgroundMove, onBackgroundAdd, onFitSample, onResetSample }: ListProps) {
  return <div className="sample-list">{samples.map((sample) => <VirtualItem key={sample.id} sample={sample} onMarkerMove={onMarkerMove} onBackgroundMove={onBackgroundMove} onBackgroundAdd={onBackgroundAdd} onFitSample={onFitSample} onResetSample={onResetSample} />)}</div>;
}
