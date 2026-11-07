import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { chords, midiFor, sample, createTrack, regenerate, commit, undo, type EditorState, type Track, type Song, type Chord } from './music';
import { MidiEditorScreen } from './midi/MidiEditorScreen';
import { Player, type PlaybackStatus } from './player';
import './style.css';
function App() {
  const [state,setState]=useState<EditorState>(()=>({current:createTrack(sample),history:[]}));
  const {current:song,history}=state;
  const [pending,setPending]=useState<{settings:Song;bar?:number}>();
  const [screen,setScreen]=useState(()=>window.location.hash==='#/midi'?'midi':'home');
  const [photo,setPhoto]=useState('');
  const [filename,setFilename]=useState('');
  const [error,setError]=useState('');
  const [playbackStatus,setPlaybackStatus]=useState<PlaybackStatus>('ready');
  const [beat,setBeat]=useState(-1);
  const bar=beat<0?-1:Math.floor(beat/4);
  const player=useRef(new Player());
  const photoRef=useRef('');
  useEffect(()=>()=>{ player.current.stop(); URL.revokeObjectURL(photoRef.current); },[]);
  function stop(){player.current.stop();setPlaybackStatus('ready');setBeat(-1);}
  useEffect(()=>{
    function navigate(){stop();setPending(undefined);setScreen(window.location.hash==='#/midi'?'midi':'home');window.scrollTo(0,0);}
    window.addEventListener('hashchange',navigate);
    return ()=>window.removeEventListener('hashchange',navigate);
  },[]);
  function edit(next:Track){stop();setPending(undefined);setState(s=>commit(s,next));}
  function request(settings:Song,bar?:number){stop();setPending({settings,bar});}
  function confirm(){if(!pending)return;try{edit(regenerate(song,pending.settings,pending.bar));setPending(undefined);setError('');}catch(e){setError((e as Error).message);}}
  async function play(){setError('');try{await player.current.play(song,setBeat,setPlaybackStatus);}catch{stop();setError('再生できませんでした。音声設定・音源の読み込みを確認し、再生ボタンで再試行するか別の音色を選んでください。');}}
  function download(){const bytes=midiFor(song);const url=URL.createObjectURL(new Blob([bytes as BlobPart],{type:'audio/midi'}));const link=document.createElement('a');link.href=url;link.download='photochord.mid';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  if(screen==='midi') return <MidiEditorScreen track={song} beat={beat} canUndo={history.length>0} loading={playbackStatus==='loading'} onEdit={edit} onStart={stop} onPlay={play} onUndo={()=>{stop();setState(s=>undo(s));}} onDownload={download} error={error}/>;
  return <><header><a className="brand" href="./"><span className="logo">♮</span> PhotoChord<span className="beta">PROTOTYPE</span></a><span className="header-note">ひとつの写真から、あなただけの伴奏へ。</span><span className="local"><i/> ローカルデモ</span></header>
  <main><div className="intro"><div><p className="eyebrow">YOUR MEMORIES, YOUR MUSIC</p><h1>写真から、音楽を育てよう。</h1><p className="subtitle">思い出をきっかけに、コードを並べて。音を聴きながら、自分らしい8小節へ。</p></div><span className="step-label">01 写真　→　02 編集　→　03 書き出し</span></div>
  <div className="workspace"><aside><div className="section-top"><h2><small>01</small> 音楽のきっかけ</h2><span>PHOTO</span></div>
  <label className={'photo '+(photo?'has-photo':'')} htmlFor="photo">{photo?<img src={photo} alt="選択した写真のプレビュー"/>:<div className="photo-art"><span className="sun"/><span className="hill back"/><span className="hill"/><span className="photo-icon">＋</span></div>}<span className="photo-caption">{filename||'写真を1枚選ぶ'}<small>JPEG / PNG / WebP・10MBまで</small></span></label>
  <input id="photo" className="file" type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{const f=e.target.files?.[0];if(!f)return;if(!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size>10*1024*1024){setError('JPEG・PNG・WebPの10MB以下の画像を選んでください。');e.target.value='';return;}URL.revokeObjectURL(photoRef.current);const url=URL.createObjectURL(f);photoRef.current=url;setPhoto(url);setFilename(f.name);setError('');}}/>
  <p className="privacy">写真はこのブラウザ内で表示します。外部送信・保存は行いません。</p>
  <div className="sample"><span className="pill">固定サンプル</span><h3>晴れた日の思い出</h3><div className="tags"><span>明るい</span><span>温かい</span><span>穏やか</span></div><p>やさしいCメジャーのコード進行。写真の分析は未接続のため、どの写真でも同じサンプルを使います。</p><button className="secondary full" onClick={()=>edit(createTrack(sample))}>サンプルを読み直す ↗</button><small>編集中の曲を置き換えます。元に戻せます。</small></div>
  </aside><section className="editor"><div className="section-top"><h2><small>02</small> 伴奏を編集</h2><span>8 BARS / 4 BEATS</span></div><div className="song-title"><div><p className="eyebrow">SAMPLE TRACK</p><h2>晴れた日の思い出 <span>↗</span></h2></div><span className="key">C major <small>初期キー</small></span></div>
  <div className="transport"><button className="play" onClick={bar>=0||playbackStatus==='loading'?stop:play}>{playbackStatus==='loading'?'■ 読み込み中':bar>=0?'■ 停止':'▶ 再生する'}</button><div className="timeline"><div style={{width:`${bar<0?0:beat/32*100}%`}}/></div><span>{bar>=0?`${bar+1} / 8 小節`:`約${Math.round(32*60/song.bpm)}秒`}</span><button className="icon-button" aria-label="最初から再生" onClick={play}>↺</button></div>
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
