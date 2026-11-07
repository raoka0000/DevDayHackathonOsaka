import { useEffect, useState } from 'react';
import { partsFor, addPart, updatePart, removePart, MAX_PARTS, type Track, type Part } from '../music';
import { instrumentFor, instruments } from '../instruments';
import { TrackVolume } from './TrackVolume';
import { PianoRoll } from './PianoRoll';
import './midi.css';

export type MidiEditorScreenProps = {
  track: Track;
  beat: number;
  cursorBeat: number;
  onSeek: (beat: number) => void;
  onPause: () => void;
  onRestart: () => Promise<void>;
  canUndo: boolean;
  loading: boolean;
  error: string;
  onEdit: (track: Track) => void;
  onStart: () => void;
  onPlay: () => Promise<void>;
  onUndo: () => void;
  onDownload: () => void;
};

export function MidiEditorScreen({
  track, beat, cursorBeat, onSeek, onPause, onRestart, canUndo, loading, error, onEdit, onStart, onPlay, onUndo, onDownload,
}: MidiEditorScreenProps) {
  const [selectedId,setSelectedId]=useState('main');
  const [partError,setPartError]=useState('');
  const parts=partsFor(track);
  const selected=parts.find(part=>part.id===selectedId)??parts[0];
  const [zoom, setZoom] = useState(48);
  const [snap, setSnap] = useState(.25);
  const [tool, setTool] = useState<'draw' | 'erase'>('draw');
  const [query, setQuery] = useState('');
  const [library, setLibrary] = useState<'samples' | 'synth'>(()=>'file' in instrumentFor(track.instrument)?'samples':'synth');
  const [tempoError, setTempoError] = useState('');
  const instrument = instrumentFor(selected.instrument);
  const audibleCount=parts.filter(part=>!part.muted&&(!parts.some(p=>p.solo)||part.solo)).length;
  function changePart(id:string,patch:Partial<Omit<Part,'id'>>){try{onEdit(updatePart(track,id,patch));setPartError('');}catch(reason){setPartError(reason instanceof Error?reason.message:'トラックを変更できませんでした。');}}
  function append(empty:boolean){
    const id=crypto.randomUUID();
    let ordinal=2;
    while(parts.some(part=>part.name===`トラック${ordinal}`)) ordinal++;
    const sound=instruments.find(item=>'file' in item&&item.id!==selected.instrument)??instruments[0];
    try{onEdit(addPart(track,{id,name:`トラック${ordinal}`,instrument:sound.id,notes:empty?[]:structuredClone(selected.notes),volume:.7,muted:false,solo:false}));setSelectedId(id);setLibrary('samples');setPartError('');}catch(reason){setPartError(reason instanceof Error?reason.message:'トラックを追加できませんでした。');}
  }
  const visibleInstruments = instruments.filter(item => (library === 'samples' ? 'file' in item : !('file' in item)) && (item.name + item.short + item.family).toLowerCase().includes(query.toLowerCase()));
  const playing = beat >= 0;
  const position = Math.max(0, cursorBeat);
  const bar = Math.floor(position / 4);
  const transport = () => (playing || loading) ? onPause() : void onPlay();
  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if (event.target instanceof HTMLElement && (event.target.matches('input,select,textarea,button,a') || event.target.isContentEditable)) return;
      if (event.code === 'Space' && !event.repeat) { event.preventDefault(); transport(); }
    }
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  });
  return <main className="midi-screen">
    <nav className="midi-navigation" aria-label="画面移動">
      <a href="#/">← 写真・コード編集</a>
      <div className="midi-wordmark"><b>♮ PhotoChord</b><span>STUDIO</span></div>
      <span className="session-badge"><i/> セッション内で編集中</span>
    </nav>
    <div className="studio-title"><div><p>YOUR SOUND, YOUR STORY</p><h1>晴れた日の思い出 <span>固定サンプル</span></h1></div><button className="studio-export" onClick={onDownload}>↓ MIDIを書き出す</button></div>
    <section className="studio-transport" aria-label="再生コントロール">
      <div className="transport-buttons"><button aria-label="最初から再生" onClick={onRestart}>↺</button><button aria-label="停止" onClick={onStart}>■</button><button className={'studio-play '+(playing?'is-playing':'')} onClick={transport}>{loading?'■ 読み込み中':playing?'Ⅱ 一時停止':'▶ 再生'}</button></div>
      <div className="position-display"><strong>{String(bar+1).padStart(3,'0')}<em>:</em>{String(Math.floor(position%4)+1).padStart(2,'0')}<em>:</em>{String(Math.floor(position%1*960)).padStart(3,'0')}</strong><small>小節 : 拍 : TICK</small></div>
      <label className="tempo-control"><input aria-label="テンポ BPM" type="number" min="60" max="160" step="1" key={track.bpm} defaultValue={track.bpm} onFocus={onStart} onBlur={e=>{const bpm=Number(e.target.value);if(Number.isInteger(bpm)&&bpm>=60&&bpm<=160){onEdit({...track,bpm});setTempoError('');}else{e.target.value=String(track.bpm);setTempoError('テンポは60〜160の整数で指定してください。');}}} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/><small>BPM · 60–160</small></label>
      <div className="meter-display"><strong>4 / 4</strong><small>拍子</small></div>
      <div className="transport-end"><span className="engine-status" role="status"><i/> {loading?'音源を読み込み中…':'file' in instrument?'サンプル音源・使用可能':'内蔵シンセ・使用可能'}</span><button className="studio-button" disabled={!canUndo} onClick={onUndo}>↶ 元に戻す</button></div>
    </section>
    {tempoError&&<p role="alert" className="error">{tempoError}</p>}
    <div className="studio-layout">
      <aside className="instrument-panel" aria-label="音源ブラウザ">
        <div className="panel-heading"><span>音源ブラウザ</span><small>{instruments.length} SOUNDS</small></div>
        <label className="sound-search"><span>⌕</span><input aria-label="音色を検索" value={query} onChange={e=>setQuery(e.target.value)} placeholder="音色を検索…"/></label>
        <div className="library-tabs" aria-label="音源の種類"><button aria-pressed={library==='samples'} onClick={()=>setLibrary('samples')}>サンプル音源 <span>6</span></button><button aria-pressed={library==='synth'} onClick={()=>setLibrary('synth')}>内蔵シンセ <span>5</span></button></div>
        <p className="library-label">{library==='samples'?'FluidR3 GM':'内蔵コレクション'} <span>{library==='samples'?'MP3 SAMPLES':'WEB AUDIO'}</span></p>
        <div className="instrument-list">{visibleInstruments.map(item=><button key={item.id} className={'instrument-card '+(instrument.id===item.id?'active':'')} aria-pressed={instrument.id===item.id} onClick={()=>changePart(selected.id,{instrument:item.id})}><span className="instrument-icon">{item.icon}</span><span><strong>{item.name}</strong><small>{item.family} · {'file' in item?'サンプル':'シンセ'}</small></span><span className="sound-selected">{instrument.id===item.id?'●':'+'}</span></button>)}</div>
        {!visibleInstruments.length&&<p className="sound-empty">一致する音色がありません。</p>}
        <div className="sound-details"><span className="detail-label">選択中の音色</span><h2>{instrument.short}</h2><p>{instrument.description}</p><dl><div><dt>音源</dt><dd>{'file' in instrument?'FluidR3 · サンプル':'内蔵・合成音'}</dd></div><div><dt>MIDI代替指定</dt><dd>GM {instrument.program+1}</dd></div></dl><p className="sound-disclaimer">MIDIでは{instrument.gmName}を指定します。出力先の音源によって響きは変わります。</p>{'file' in instrument&&<p className="sound-credit">FluidR3 by Frank Wen · 変換 Benjamin Gleitzman<br/><a href="/soundfonts/FluidR3_GM/LICENSE-SAMPLES.html" target="_blank" rel="noreferrer">CC BY 3.0 US</a> · <a href="https://github.com/gleitz/midi-js-soundfonts" target="_blank" rel="noreferrer">配布元</a></p>}</div>
      </aside>
      <section className="studio-workspace" aria-label="MIDI編集ワークスペース">
        <div className="panel-heading"><span>アレンジメント <small>{parts.length} TRACKS · 8 BARS · {audibleCount}トラック再生</small></span><div className="track-actions"><button disabled={parts.length>=MAX_PARTS} onClick={()=>append(false)}>＋ 楽器を重ねる</button><button disabled={parts.length>=MAX_PARTS} onClick={()=>append(true)}>＋ 空トラック</button></div></div>
        <p className="track-help">「楽器を重ねる」は選択中の音符を新しい楽器へコピーします。トラックを選ぶと、その音符と音色を編集できます。</p>
        <div className="arrangement-tracks">{parts.map((part,index)=>{
          const sound=instrumentFor(part.instrument), chosen=part.id===selected.id;
          const audible=!part.muted&&(!parts.some(item=>item.solo)||part.solo);
          return <div key={part.id} className={'arrangement track-row '+(chosen?'selected-track ':'')+(!audible?'muted-track':'')}>
            <div className="track-controls"><button className="track-select" aria-pressed={chosen} aria-label={`${part.name}を選択`} onClick={()=>{onStart();setSelectedId(part.id);setLibrary('file' in sound?'samples':'synth');}}><span>{String(index+1).padStart(2,'0')}</span><div><strong>{part.name}</strong><small>{sound.short} · CH {index+1}</small></div></button>
              <div className="track-mixer"><button className={part.muted?'enabled mute':''} aria-label={`${part.name}をミュート`} aria-pressed={part.muted} onClick={()=>changePart(part.id,{muted:!part.muted})}>M</button><button className={part.solo?'enabled solo':''} aria-label={`${part.name}をソロ`} aria-pressed={part.solo} onClick={()=>changePart(part.id,{solo:!part.solo})}>S</button><TrackVolume name={part.name} value={part.volume} onStart={onStart} onApply={volume=>changePart(part.id,{volume})}/></div>
            </div>
            <button className="clip-area" aria-label={`${part.name}の音符を編集`} onClick={()=>{onStart();setSelectedId(part.id);setLibrary('file' in sound?'samples':'synth');}}><div className="clip-ruler">{track.bars.map((_,i)=><span key={i}>{i+1}</span>)}</div><div className="midi-clip"><div className="clip-title"><span>♫ {sound.name}</span><span>{part.notes.length} notes</span></div><svg viewBox="0 0 1000 60" preserveAspectRatio="none" role="img" aria-label={`${part.name}の音符の全体像`}>{part.notes.map((note,i)=><rect key={i} x={note.startBeat/32*1000} y={(84-note.pitch)/37*56} width={Math.max(2,note.durationBeats/32*1000)} height="2.5" rx="1"/>)}</svg>{!part.notes.length&&<span className="empty-clip">ピアノロールから音符を追加</span>}</div><div className={'arrangement-playhead '+(!playing?'paused':'')} style={{left:`${position/32*100}%`}}/></button>
          </div>;
        })}</div>
        <div className="selected-track-settings"><label>編集中<input aria-label="選択トラック名" key={selected.id+selected.name} defaultValue={selected.name} maxLength={60} onFocus={onStart} onBlur={event=>{if(event.target.value.trim())changePart(selected.id,{name:event.target.value.trim()});else event.target.value=selected.name;}} onKeyDown={event=>{if(event.key==='Enter')event.currentTarget.blur();}}/></label><span>{instrument.name} · {selected.notes.length}音</span><button className="studio-button" disabled={selected.id==='main'} onClick={()=>{onEdit(removePart(track,selected.id));setSelectedId('main');}}>トラックを削除</button></div>
        {partError&&<p role="alert" className="error">{partError}</p>}
        <div className="roll-toolbar"><div className="roll-tab">▥ ピアノロール</div><div className="edit-tools" aria-label="音符の編集ツール"><button aria-pressed={tool==='draw'} onClick={()=>setTool('draw')}>✎ 追加・選択</button><button aria-pressed={tool==='erase'} onClick={()=>setTool('erase')}>⌫ 消しゴム</button></div><label>グリッド<select aria-label="グリッド幅" value={snap} onChange={e=>setSnap(Number(e.target.value))}><option value="0.25">1/16</option><option value="0.5">1/8</option><option value="1">1/4</option></select></label><label className="zoom-control">ズーム<input aria-label="ピアノロールのズーム" type="range" min="32" max="96" step="8" value={zoom} onChange={e=>setZoom(Number(e.target.value))}/><span>{Math.round(zoom/48*100)}%</span></label></div>
        <PianoRoll key={selected.id} track={{...track,notes:selected.notes,instrument:selected.instrument}} beat={position} onSeek={onSeek} onEdit={next=>changePart(selected.id,{notes:next.notes})} onStart={onStart} beatWidth={zoom} snap={snap} tool={tool}/>
        {error&&<p role="alert" className="error">{error}</p>}
      </section>
    </div>
    <footer className="studio-footer"><span><i/> {instrument.name} <b> / </b> {parts.reduce((total,part)=>total+part.notes.length,0)}音 <b> / </b> {parts.length}トラック・8小節</span><span>Space 再生・一時停止　·　Delete 音符削除　·　Esc ドラッグ取消</span><span>再読み込みで編集内容は消えます</span></footer>
  </main>;
}
