import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { chords, midiFor, sample, createTrack, regenerate, commit, undo, type EditorState, type Track, type Song, type Chord } from './music';
import { MidiEditorScreen } from './midi/MidiEditorScreen';
import { Player } from './player';
import './style.css';
type GeneratedMusic = { bpm: number; bars: string[]; pattern: 'block' | 'arpeggio'; mood: string[]; explanation: string };
function App() {
  const [state,setState]=useState<EditorState>(()=>({current:createTrack(sample),history:[]}));
  const {current:song,history}=state;
  const [pending,setPending]=useState<{settings:Song;bar?:number}>();
  const [screen,setScreen]=useState(()=>window.location.hash==='#/midi'?'midi':'home');
  const [photo,setPhoto]=useState('');
  const [photoFile,setPhotoFile]=useState<File|null>(null);
  const [filename,setFilename]=useState('');
  const [error,setError]=useState('');
  const [generated,setGenerated]=useState<GeneratedMusic|null>(null);
  const [generating,setGenerating]=useState(false);
  const [beat,setBeat]=useState(-1);
  const bar=beat<0?-1:Math.floor(beat/4);
  const player=useRef(new Player());
  const photoRef=useRef('');
  const generateIdRef=useRef(0);
  useEffect(()=>()=>{ player.current.stop(); URL.revokeObjectURL(photoRef.current); },[]);
  function stop(){player.current.stop();setBeat(-1);}
  useEffect(()=>{
    function navigate(){stop();setPending(undefined);setScreen(window.location.hash==='#/midi'?'midi':'home');window.scrollTo(0,0);}
    window.addEventListener('hashchange',navigate);
    return ()=>window.removeEventListener('hashchange',navigate);
  },[]);
  function edit(next:Track){stop();setPending(undefined);setGenerated(null);setState(s=>commit(s,next));}
  function request(settings:Song,bar?:number){stop();setPending({settings,bar});}
  function confirm(){if(!pending)return;try{edit(regenerate(song,pending.settings,pending.bar));setPending(undefined);setError('');}catch(e){setError((e as Error).message);}}
  async function play(){setError('');try{await player.current.play(song,setBeat);}catch{stop();setError('再生できませんでした。ブラウザの音声設定を確認して再試行してください。');}}
  async function generate(){if(!photoFile||generating)return;setError('');setGenerated(null);const reqId=++generateIdRef.current;setGenerating(true);try{const fd=new FormData();fd.append('photo',photoFile);const res=await fetch('/api/songs',{method:'POST',body:fd});if(reqId!==generateIdRef.current)return;if(!res.ok){const err=await res.json().catch(()=>({error:'通信エラーが発生しました。'}));setError(err.error||'音楽の生成に失敗しました。');return;}const data=await res.json() as GeneratedMusic;setGenerated(data);}catch(e){if(reqId!==generateIdRef.current)return;setError('ネットワークエラーが発生しました。接続を確認して再試行してください。');}finally{if(reqId===generateIdRef.current)setGenerating(false);}}
  function applyGenerated(){if(!generated)return;edit(createTrack({bpm:generated.bpm,bars:generated.bars as Chord[],pattern:generated.pattern}));setGenerated(null);}
  function download(){const bytes=midiFor(song);const url=URL.createObjectURL(new Blob([bytes as BlobPart],{type:'audio/midi'}));const link=document.createElement('a');link.href=url;link.download='photochord.mid';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  if(screen==='midi') return <MidiEditorScreen track={song} beat={beat} canUndo={history.length>0} onEdit={edit} onStart={stop} onPlay={play} onUndo={()=>{stop();setState(s=>undo(s));}} onDownload={download} error={error}/>;
  return <><header><a className="brand" href="./"><span className="logo">♮</span> PhotoChord<span className="beta">PROTOTYPE</span></a><span className="header-note">ひとつの写真から、あなただけの伴奏へ。</span><span className="local"><i/> ローカルデモ</span></header>
  <main><div className="intro"><div><p className="eyebrow">YOUR MEMORIES, YOUR MUSIC</p><h1>写真から、音楽を育てよう。</h1><p className="subtitle">思い出をきっかけに、コードを並べて。音を聴きながら、自分らしい8小節へ。</p></div><span className="step-label">01 写真　→　02 編集　→　03 書き出し</span></div>
  <div className="workspace"><aside><div className="section-top"><h2><small>01</small> 音楽のきっかけ</h2><span>PHOTO</span></div>
  <label className={'photo '+(photo?'has-photo':'')} htmlFor="photo">{photo?<img src={photo} alt="選択した写真のプレビュー"/>:<div className="photo-art"><span className="sun"/><span className="hill back"/><span className="hill"/><span className="photo-icon">＋</span></div>}<span className="photo-caption">{filename||'写真を1枚選ぶ'}<small>JPEG / PNG / WebP・10MBまで</small></span></label>
  <input id="photo" className="file" type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{const f=e.target.files?.[0];if(!f)return;if(!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size>10*1024*1024){setError('JPEG・PNG・WebPの10MB以下の画像を選んでください。');e.target.value='';return;}URL.revokeObjectURL(photoRef.current);const url=URL.createObjectURL(f);photoRef.current=url;setPhoto(url);setPhotoFile(f);setFilename(f.name);setGenerated(null);setError('');}}/>
  {photo&&<div className="generate-section"><p className="disclosure"><strong>⚠ AI分析について：</strong>選択した写真をOpenAI社のサーバーに送信し、音楽設定の提案を生成します。写真は分析後に破棄され、永続保存されません。</p><button className="secondary full" onClick={generate} disabled={generating||!photoFile}>{generating?'⏳ 生成中...':'✧ 写真から音楽を生成する'}</button>{generating&&<small>通常30秒以内に完了します。ページを閉じないでください。</small>}</div>}
  {generated&&<div className="generated"><span className="pill">AI生成</span><h3>{generated.explanation}</h3><div className="tags">{generated.mood.map((m,i)=><span key={i}>{m}</span>)}</div><p>テンポ {generated.bpm} BPM・{generated.pattern==='arpeggio'?'分散和音':'ブロックコード'}・コード進行 {generated.bars.join(' → ')}</p><button className="secondary full" onClick={applyGenerated}>この設定で音楽を作る ↗</button><small>編集中の曲を置き換えます。元に戻せます。</small></div>}
  <div className="sample"><span className="pill">固定サンプル</span><h3>晴れた日の思い出</h3><div className="tags"><span>明るい</span><span>温かい</span><span>穏やか</span></div><p>やさしいCメジャーのコード進行。写真がない場合や試用時にお使いください。</p><button className="secondary full" onClick={()=>{edit(createTrack(sample));setGenerated(null);}}>サンプルを読み直す ↗</button><small>編集中の曲を置き換えます。元に戻せます。</small></div>
  </aside><section className="editor"><div className="section-top"><h2><small>02</small> 伴奏を編集</h2><span>8 BARS / 4 BEATS</span></div><div className="song-title"><div><p className="eyebrow">SAMPLE TRACK</p><h2>晴れた日の思い出 <span>↗</span></h2></div><span className="key">C major <small>初期キー</small></span></div>
  <div className="transport"><button className="play" onClick={bar>=0?stop:play}>{bar>=0?'■ 停止':'▶ 再生する'}</button><div className="timeline"><div style={{width:`${bar<0?0:beat/32*100}%`}}/></div><span>{bar>=0?`${bar+1} / 8 小節`:`約${Math.round(32*60/song.bpm)}秒`}</span><button className="icon-button" aria-label="最初から再生" onClick={play}>↺</button></div>
  <div className="settings"><label>テンポ <span><strong>{song.bpm}</strong> BPM</span><input aria-label="テンポ" type="range" min="60" max="160" value={song.bpm} onChange={e=>edit({...song,bpm:Number(e.target.value)})}/><div className="range-labels"><small>ゆったり 60</small><small>160 軽快に</small></div></label><label>伴奏パターン<select value={song.pattern} onChange={e=>request({...song,pattern:e.target.value as Song['pattern']})}><option value="arpeggio">分散和音 — 音をひとつずつ</option><option value="block">ブロックコード — 音を重ねて</option></select></label></div>
  <div className="chords-heading"><h3>コード進行</h3><span>各小節のコードを選んで変更</span></div><div className="chords">{song.bars.map((chord,i)=><label key={i} className={'chord '+(bar===i?'active':'')}><span>{String(i+1).padStart(2,'0')}<small>{bar===i?'演奏中':'小節'}</small></span><select aria-label={`${i+1}小節目のコード`} value={chord} onChange={e=>request({...song,bars:song.bars.map((c,j)=>j===i?e.target.value as Chord:c)},i)}>{chords.map(c=><option key={c}>{c}</option>)}</select><div className="beats">● ● ● ●</div></label>)}</div>
  <div className="edit-footer"><p>コードやテンポの変更は、次の再生から反映されます。</p><button className="text-button" disabled={!history.length} onClick={()=>{stop();setPending(undefined);setState(s=>undo(s));}}>↶ 元に戻す</button></div>
  {pending&&<div className="regenerate" role="dialog" aria-label="音符の再生成"><p>{pending.bar===undefined?'全小節':`${pending.bar+1}小節目（開始拍がこの小節にある音符）`}の音符を再生成し、対象範囲の手編集を置き換えます。小節をまたぐ音符との重複が生じる場合は適用できません。元に戻せます。</p><button className="secondary" onClick={confirm}>再生成を適用</button> <button className="secondary" onClick={()=>setPending(undefined)}>キャンセル</button></div>}
  <p><a className="secondary" href="#/midi">MIDI編集画面を開く →</a></p>
  <div className="ai"><span className="ai-symbol">✧</span><div><h3>言葉で音楽を変える <span className="pill">準備中</span></h3><p>「後半をもっと感動的に」など、AIによる編集提案は今後接続します。</p></div></div>
  <div className="export"><div><h3>できた伴奏を、次の制作へ。</h3><p>テンポ・拍子・音符を含むMIDIを書き出せます。</p></div><button className="download" onClick={download}>↓ MIDIを書き出す</button></div>
  </section></div>{error&&<p role="alert" className="error">{error}</p>}<footer><span>PhotoChord / 写真からはじまる音楽づくり</span><span>音色はブラウザ合成音 · 保存はセッション内のみ</span></footer></main></>;
}
createRoot(document.getElementById('root')!).render(<App/>);
