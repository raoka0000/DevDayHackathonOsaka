import { useEffect, useState } from 'react';

export function TrackVolume({ name, value, onStart, onApply }: {
  name: string; value: number; onStart: () => void; onApply: (volume: number) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return <label>音量<input aria-label={`${name}の音量`} type="range" min="0" max="100" step="1"
    value={Math.round(draft * 100)} onFocus={onStart} onPointerDown={onStart}
    onChange={event => setDraft(Number(event.currentTarget.value) / 100)}
    onPointerUp={event => onApply(Number(event.currentTarget.value) / 100)}
    onKeyUp={event => { if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(event.key)) onApply(Number(event.currentTarget.value) / 100); }}
    onBlur={event => onApply(Number(event.currentTarget.value) / 100)}
    onPointerCancel={() => setDraft(value)}/><span>{Math.round(draft * 100)}%</span></label>;
}
