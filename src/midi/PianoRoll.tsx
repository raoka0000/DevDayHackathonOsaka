import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { replaceNote, type Note, type Track } from '../music';

const rowHeight = 22;
const name = (pitch: number) => `${['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'][pitch % 12]}${Math.floor(pitch / 12) - 1}`;
type Drag = { index: number; x: number; y: number; original: Note; draft: Note; resize: boolean };
type Props = {
  track: Track; beat: number; onEdit: (track: Track) => void; onStart: () => void;
  beatWidth: number; snap: number; tool: 'draw' | 'erase';
};

export function PianoRoll({ track, beat, onEdit, onStart, beatWidth, snap, tool }: Props) {
  const [selected, setSelected] = useState(-1);
  const [draft, setDraft] = useState<Note>();
  const [error, setError] = useState('');
  const drag = useRef<Drag | undefined>(undefined);
  const scroll = useRef<HTMLDivElement>(null);
  const note = track.notes[selected];
  const width = 32 * beatWidth;
  useEffect(() => { if (scroll.current) scroll.current.scrollTop = 240; }, []);

  function apply(index: number, next?: Note) {
    try {
      onEdit(replaceNote(track, index, next));
      setError('');
      if (!next) setSelected(-1);
    } catch (reason) { setError(reason instanceof Error ? reason.message : '音符を変更できませんでした。'); }
  }
  function begin(event: PointerEvent<HTMLButtonElement>, index: number) {
    if (event.button !== 0) return;
    event.preventDefault(); event.stopPropagation();
    event.currentTarget.focus(); onStart(); setSelected(index);
    if (tool === 'erase') { apply(index); return; }
    const original = track.notes[index];
    drag.current = { index, x: event.clientX, y: event.clientY, original, draft: original, resize: event.target instanceof HTMLElement && event.target.dataset.resize === 'true' };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function move(event: PointerEvent<HTMLButtonElement>) {
    const current = drag.current;
    if (!current) return;
    const dx = event.clientX - current.x, dy = event.clientY - current.y;
    if (Math.abs(dx) < 3 && Math.abs(dy) < 3) { current.draft = current.original; setDraft(undefined); return; }
    current.draft = current.resize
      ? { ...current.original, durationBeats: Math.round((current.original.durationBeats + dx / beatWidth) / snap) * snap }
      : { ...current.original, startBeat: current.original.startBeat + Math.round(dx / beatWidth / snap) * snap, pitch: current.original.pitch - Math.round(dy / rowHeight) };
    setDraft(current.draft);
  }
  function cancel() { drag.current = undefined; setDraft(undefined); }

  return <section className="piano" aria-label="ピアノロール">
    <div className="piano-scroll" ref={scroll} aria-label="8小節のピアノロール">
      <div className="piano-content" style={{ width: width + 60 }}>
        <div className="ruler">{Array.from({ length: 32 }, (_, i) => <span key={i} className={i % 4 === 0 ? 'bar-line' : ''} style={{ left: 60 + i * beatWidth, width: beatWidth }}>{Math.floor(i / 4) + 1}.{i % 4 + 1}</span>)}</div>
        <div className="pitch-labels">{Array.from({ length: 37 }, (_, i) => <div className={(name(84-i).includes('♯') ? 'black-key' : 'white-key') + ((84-i)%12===0?' octave-key':'')} key={i}>{name(84 - i)}</div>)}</div>
        <div className={'note-grid '+(tool==='erase'?'erase-mode':'')} style={{ width, backgroundSize: `${beatWidth*4}px 100%, ${beatWidth}px 100%, ${beatWidth*snap}px 100%, 100% ${rowHeight}px` }} onClick={event => {
          if (event.target !== event.currentTarget || tool === 'erase') return;
          onStart();
          const rect = event.currentTarget.getBoundingClientRect();
          const startBeat = Math.floor((event.clientX - rect.left) / beatWidth / snap) * snap;
          const next = { pitch: 84 - Math.floor((event.clientY - rect.top) / rowHeight), startBeat, durationBeats: 1, velocity: 78 };
          try { const changed = replaceNote(track, -1, next); onEdit(changed); setSelected(changed.notes.length - 1); setError(''); }
          catch (reason) { setError(reason instanceof Error ? reason.message : '音符を追加できませんでした。'); }
        }}>
          {track.notes.map((original, index) => {
            const shown = selected === index && draft ? draft : original;
            return <button key={index} type="button" className={'note ' + (selected === index ? 'selected' : '')} aria-label={`音符${index + 1} ${name(original.pitch)} 開始${original.startBeat} 長さ${original.durationBeats}`} aria-pressed={selected === index}
              style={{ left: shown.startBeat * beatWidth, top: (84 - shown.pitch) * rowHeight, width: shown.durationBeats * beatWidth, height: rowHeight - 3, opacity: .5 + shown.velocity / 254 }}
              onFocus={() => { onStart(); setSelected(index); }} onPointerDown={event => begin(event, index)} onPointerMove={move}
              onPointerUp={() => { const current = drag.current; cancel(); if (current) apply(current.index, current.draft); }}
              onPointerCancel={cancel} onLostPointerCapture={cancel}
              onKeyDown={event => {
                if (event.key === 'Escape') { cancel(); return; }
                if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); onStart(); apply(index); }
                if (event.key.startsWith('Arrow')) {
                  event.preventDefault(); onStart();
                  if (event.key === 'ArrowUp' || event.key === 'ArrowDown') apply(index, { ...original, pitch: original.pitch + (event.key === 'ArrowUp' ? 1 : -1) });
                  else if(event.shiftKey) apply(index, { ...original, durationBeats: Math.round((original.durationBeats + (event.key === 'ArrowRight' ? snap : -snap)) / snap) * snap });
                  else apply(index, { ...original, startBeat: original.startBeat + (event.key === 'ArrowRight' ? snap : -snap) });
                }
              }}>{name(original.pitch)}<span data-resize="true" className="resize"/></button>;
          })}
          {beat >= 0 && <div className="playhead" style={{ left: beat * beatWidth }}/>}
        </div>
      </div>
      <div className="velocity-lane" style={{ width: width + 60 }}><span className="velocity-label">強さ</span>{track.notes.map((item,index)=><button key={index} className={selected===index?'selected':''} aria-label={`音符${index+1}の強さ ${item.velocity}`} style={{left:60+item.startBeat*beatWidth,height:item.velocity/127*52}} onClick={()=>{onStart();setSelected(index);}}/>)}{beat>=0&&<div className="playhead" style={{left:60+beat*beatWidth}}/>}</div>
    </div>
    <div className="note-inspector"><div className="inspector-title"><span>音符の設定</span><small>{note?name(note.pitch)+' · 選択中':'音符を選択してください'}</small></div>
      {note ? <form key={`${selected}-${JSON.stringify(note)}`} className="note-fields" onFocus={onStart} onSubmit={event => {
        event.preventDefault(); onStart();
        const data = new FormData(event.currentTarget);
        apply(selected, { pitch: Number(data.get('pitch')), startBeat: Number(data.get('start')), durationBeats: Number(data.get('duration')), velocity: Number(data.get('velocity')) });
      }}>
        <label>音高<input name="pitch" aria-label="選択音符の音高" type="number" defaultValue={note.pitch} required step="1"/></label>
        <label>開始拍<input name="start" aria-label="選択音符の開始拍" type="number" defaultValue={note.startBeat} required step="0.25"/></label>
        <label>長さ / 拍<input name="duration" aria-label="選択音符の長さ" type="number" defaultValue={note.durationBeats} required step="any"/></label>
        <label>強さ<input name="velocity" aria-label="選択音符の強さ" type="number" min="1" max="127" defaultValue={note.velocity} required step="1"/></label>
        <button className="studio-button primary" type="submit">音符に適用</button><button type="button" className="studio-button" onClick={() => { onStart(); apply(selected); }}>削除</button>
      </form> : <p className="piano-help">空白をクリックして追加。音符をドラッグして移動、右端で長さを変更できます。</p>}
    </div>
    {error && <p role="alert" className="error">{error}</p>}
  </section>;
}
