import { useRef, useState, type PointerEvent } from 'react';
import { replaceNote, type Note, type Track } from '../music';
const beatWidth=48, rowHeight=22;
const name=(pitch:number)=>`${['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'][pitch%12]}${Math.floor(pitch/12)-1}`;
type Drag={index:number; x:number; y:number; original:Note; draft:Note; resize:boolean};
export function PianoRoll({track,beat,onEdit,onStart}:{track:Track;beat:number;onEdit:(t:Track)=>void;onStart:()=>void}) {
 const [selected,setSelected]=useState(-1), [draft,setDraft]=useState<Note>(), [error,setError]=useState('');
 const drag=useRef<Drag | undefined>(undefined);
 const note=track.notes[selected];
 function apply(index:number,n?:Note){try{if(n && (n.durationBeats<.25 || !Number.isInteger(n.startBeat*4))) throw new Error('開始拍は0.25拍刻み、長さは0.25拍以上にしてください。');onEdit(replaceNote(track,index,n));setError('');if(!n)setSelected(-1);}catch(e){setError((e as Error).message);}}
 function begin(e:PointerEvent<HTMLButtonElement>,index:number){if(e.button!==0)return;e.preventDefault();e.stopPropagation();e.currentTarget.focus();onStart();setSelected(index);const original=track.notes[index];drag.current={index,x:e.clientX,y:e.clientY,original,draft:original,resize:(e.target as HTMLElement).dataset.resize==='true'};e.currentTarget.setPointerCapture(e.pointerId);}
 function move(e:PointerEvent<HTMLButtonElement>){const d=drag.current;if(!d)return;const delta=Math.round((e.clientX-d.x)/beatWidth*4)/4;d.draft=d.resize?{...d.original,durationBeats:Math.round((d.original.durationBeats+(e.clientX-d.x)/beatWidth)*4)/4}:{...d.original,startBeat:d.original.startBeat+delta,pitch:d.original.pitch-Math.round((e.clientY-d.y)/rowHeight)};setDraft(d.draft);}
 function cancel(){drag.current=undefined;setDraft(undefined);}
 return <section className="piano"><div className="chords-heading"><h3>音符を直接編集</h3><span>{track.notes.length}音 · 16分音符刻み</span></div>
 <p className="piano-help">空白をクリックして追加。音符をドラッグして移動、右端で長さ変更。Escapeでドラッグを取り消し。</p>
 <div className="piano-scroll" aria-label="8小節のピアノロール"><div className="piano-content">
 <div className="ruler">{Array.from({length:32},(_,i)=><span key={i} style={{left:60+i*beatWidth}}>{Math.floor(i/4)+1}.{i%4+1}</span>)}</div>
 <div className="pitch-labels">{Array.from({length:37},(_,i)=><div key={i}>{name(84-i)}</div>)}</div>
 <div className="note-grid" onClick={e=>{if(e.target!==e.currentTarget)return;onStart();const rect=e.currentTarget.getBoundingClientRect();const startBeat=Math.floor((e.clientX-rect.left)/beatWidth*4)/4;const n={pitch:84-Math.floor((e.clientY-rect.top)/rowHeight),startBeat,durationBeats:1,velocity:78};try{const next=replaceNote(track,-1,n);onEdit(next);setSelected(next.notes.length-1);setError('');}catch(err){setError((err as Error).message);}}}>
 {track.notes.map((n,i)=>{const shown=selected===i&&draft?draft:n;return <button key={i} type="button" className={'note '+(selected===i?'selected':'')} aria-label={`音符${i+1} ${name(n.pitch)} 開始${n.startBeat} 長さ${n.durationBeats}`} aria-pressed={selected===i} style={{left:shown.startBeat*beatWidth,top:(84-shown.pitch)*rowHeight,width:shown.durationBeats*beatWidth,height:rowHeight-2}} onFocus={()=>{onStart();setSelected(i);}} onPointerDown={e=>begin(e,i)} onPointerMove={move} onPointerUp={()=>{const d=drag.current;cancel();if(d)apply(d.index,d.draft);}} onPointerCancel={cancel} onLostPointerCapture={cancel} onKeyDown={e=>{if(e.key==='Escape')cancel();if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();onStart();apply(i);}}}>{name(n.pitch)}<span data-resize="true" className="resize"/></button>;})}
 {beat>=0&&<div className="playhead" style={{left:beat*beatWidth}}/>}
 </div></div></div>
 {note?<form key={`${selected}-${JSON.stringify(note)}`} className="note-fields" onFocus={onStart} onSubmit={e=>{e.preventDefault();onStart();const data=new FormData(e.currentTarget);apply(selected,{...note,pitch:Number(data.get('pitch')),startBeat:Number(data.get('start')),durationBeats:Number(data.get('duration'))});}}>
 <label>音高 (48〜84)<input name="pitch" aria-label="選択音符の音高" type="number" defaultValue={note.pitch} required step="1"/></label><label>開始拍 (0〜32)<input name="start" aria-label="選択音符の開始拍" type="number" defaultValue={note.startBeat} required step="0.25"/></label><label>長さ (拍)<input name="duration" aria-label="選択音符の長さ" type="number" defaultValue={note.durationBeats} required step="any"/></label><span>強さ {note.velocity}</span><button className="secondary">音符に適用</button><button type="button" className="secondary" onClick={()=>{onStart();apply(selected);}}>削除</button>
 </form>:<p className="piano-help">音符を選択すると数値でも編集できます。開始拍は曲の先頭が0です。</p>}
 {error&&<p role="alert" className="error">{error}</p>}
 </section>;
}
