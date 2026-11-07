import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { chords, midiFor, sample, createTrack, regenerate, commit, undo, validateSong, type EditorState, type Track, type Song, type Chord } from './music';
import { parseImageAnalysis, type ImageAnalysis } from './imageAnalysis';
import { MidiEditorScreen } from './midi/MidiEditorScreen';
import { Player, type PlaybackStatus } from './player';
import './style.css';
function App() {
  const [state,setState]=useState<EditorState>(()=>({current:{...createTrack(sample),instrument:'piano'},history:[]}));
  const {current:song,history}=state;
  const [pending,setPending]=useState<{settings:Song;bar?:number}>();
  const [screen,setScreen]=useState(()=>window.location.hash==='#/midi'?'midi':'home');
  const [photos,setPhotos]=useState<File[]>([]);
  const [previews,setPreviews]=useState<string[]>([]);
  const [proposal,setProposal]=useState<{analysis:ImageAnalysis;song:Song}|null>(null);
  const [analyzing,setAnalyzing]=useState(false);
  const [error,setError]=useState('');
  const [playbackStatus,setPlaybackStatus]=useState<PlaybackStatus>('ready');
  const [beat,setBeat]=useState(-1);
  const [cursorBeat,setCursorBeat]=useState(0);
  const bar=beat<0?-1:Math.floor(beat/4);
  const player=useRef(new Player());
  const playingRequested=useRef(false);
  const previewRef=useRef<string[]>([]);
  const requestRef=useRef<AbortController|null>(null);
  const generationRef=useRef(0);
  useEffect(()=>()=>{ player.current.stop(); requestRef.current?.abort(); generationRef.current++; previewRef.current.forEach(URL.revokeObjectURL); },[]);
  function stop(){playingRequested.current=false;player.current.stop();setPlaybackStatus('ready');setBeat(-1);setCursorBeat(0);}
  function pause(){playingRequested.current=false;const current=player.current.currentBeat();player.current.stop();setPlaybackStatus('ready');setBeat(-1);setCursorBeat(Math.min(31.75,current));}
  function seek(value:number){
    if(!Number.isFinite(value))return;
    const target=Math.max(0,Math.min(31.75,Math.round(value*4)/4));
    const resume=playingRequested.current;
    player.current.stop();setPlaybackStatus('ready');setBeat(-1);setCursorBeat(target);
    if(resume)void startPlayback(target);
  }
  useEffect(()=>{
    function navigate(){stop();setPending(undefined);setScreen(window.location.hash==='#/midi'?'midi':'home');window.scrollTo(0,0);}
    window.addEventListener('hashchange',navigate);
    return ()=>window.removeEventListener('hashchange',navigate);
  },[]);
  function invalidate(){generationRef.current++;requestRef.current?.abort();requestRef.current=null;setAnalyzing(false);setProposal(null);}
  function selectPhotos(files:File[]){
    if(!files.length)return;
    if(files.length>5||files.some(f=>!['image/jpeg','image/png','image/webp'].includes(f.type)||!f.size||f.size>10*1024*1024)||files.reduce((n,f)=>n+f.size,0)>20*1024*1024){setError('写真はJPEG・PNG・WebPを1〜5枚、各10 MiB以下・合計20 MiB以下で選んでください。');return;}
    invalidate(); previewRef.current.forEach(URL.revokeObjectURL); const urls=files.map(f=>URL.createObjectURL(f));previewRef.current=urls;setPhotos(files);setPreviews(urls);setError('');
  }
  async function analyzePhotos(){
    if(!photos.length||requestRef.current)return;
    invalidate();const controller=new AbortController();requestRef.current=controller;const sequence=generationRef.current;setAnalyzing(true);setError('');
    const form=new FormData();photos.forEach(file=>form.append('images',file));
    try{
      const response=await fetch('/api/image-analysis',{method:'POST',body:form,signal:controller.signal});
      if(!response.ok)throw new Error('analysis');
      const result=await response.json();const analysis=parseImageAnalysis(result.analysis);
      if(!analysis||!result.song||typeof result.song!=='object'||!Array.isArray(result.song.bars))throw new Error('invalid');
      validateSong(result.song);if(sequence===generationRef.current)setProposal({analysis,song:result.song});
    }catch{if(!controller.signal.aborted&&sequence===generationRef.current)setError('写真を分析できませんでした。画像や接続、APIの設定を確認して再試行してください。');}
    finally{if(sequence===generationRef.current){requestRef.current=null;setAnalyzing(false);}}
  }
  function edit(next:Track){invalidate();stop();setPending(undefined);setState(s=>commit(s,next));}
  function request(settings:Song,bar?:number){invalidate();stop();setPending({settings,bar});}
  function confirm(){if(!pending)return;try{edit(regenerate(song,pending.settings,pending.bar));setPending(undefined);setError('');}catch(e){setError((e as Error).message);}}
  async function startPlayback(fromBeat:number){playingRequested.current=true;setError('');setCursorBeat(fromBeat);setBeat(-1);setPlaybackStatus('loading');try{await player.current.play(song,value=>{if(value<0)playingRequested.current=false;setBeat(value);setCursorBeat(value<0?0:value);},setPlaybackStatus,fromBeat);}catch{stop();setError('再生できませんでした。音声設定・音源の読み込みを確認し、再生ボタンで再試行するか別の音色を選んでください。');}}
  async function play(){await startPlayback(cursorBeat);}
  async function restart(){await startPlayback(0);}
  function download(){const bytes=midiFor(song);const url=URL.createObjectURL(new Blob([bytes as BlobPart],{type:'audio/midi'}));const link=document.createElement('a');link.href=url;link.download='photochord.mid';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  if(screen==='midi') return <MidiEditorScreen track={song} beat={beat} cursorBeat={cursorBeat} onSeek={seek} onPause={pause} onRestart={restart} canUndo={history.length>0} loading={playbackStatus==='loading'} onEdit={edit} onStart={stop} onPlay={play} onUndo={()=>{invalidate();stop();setState(s=>undo(s));}} onDownload={download} error={error}/>;
  return <><header><a className="brand" href="./"><span className="logo">♮</span> PhotoChord<span className="beta">PROTOTYPE</span></a><span className="header-note">ひとつの写真から、あなただけの伴奏へ。</span><span className="local"><i/> ローカルデモ</span></header>
  <main><div className="intro"><div><p className="eyebrow">YOUR MEMORIES, YOUR MUSIC</p><h1>写真から、音楽を育てよう。</h1><p className="subtitle">思い出をきっかけに、コードを並べて。音を聴きながら、自分らしい8小節へ。</p></div><span className="step-label">01 写真　→　02 編集　→　03 書き出し</span></div>
  <div className="workspace"><aside><div className="section-top"><h2><small>01</small> 音楽のきっかけ</h2><span>PHOTO</span></div>
  <label className={'photo '+(previews.length?'has-photo':'')} htmlFor="photo">{previews.length?<img src={previews[0]} alt="選択した写真のプレビュー"/>:<div className="photo-art"><span className="sun"/><span className="hill back"/><span className="hill"/><span className="photo-icon">＋</span></div>}<span className="photo-caption">{photos.length?`${photos.length}枚を選択中`:'写真を選ぶ'}<small>1〜5枚・各10 MiB・合計20 MiBまで</small></span></label>
  <input id="photo" className="file" type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={e=>{selectPhotos(Array.from(e.target.files||[]));e.target.value='';}}/>
  {previews.length>1&&<div className="photo-previews">{previews.slice(1).map((url,i)=><img key={url} src={url} alt={`${i+2}枚目の写真`}/>)}</div>}
  <p className="privacy">「写真から提案する」を押すと、選んだ写真をサーバー経由でOpenAIへ送信します。アプリには写真を保存しません。OpenAI側の取扱いは<a href="https://developers.openai.com/api/docs/guides/your-data" target="_blank" rel="noreferrer">データ管理の説明</a>をご確認ください。</p>
  <button className="secondary full" disabled={!photos.length||analyzing} onClick={analyzePhotos}>{analyzing?'写真を分析中…':'写真から提案する'}</button>
  {proposal&&<div className="sample"><span className="pill">写真からの提案</span><p>{proposal.analysis.moods.join('・')}<br/>{proposal.analysis.description}</p><p>{proposal.song.bars.join(' | ')}<br/>{proposal.song.bpm} BPM / {proposal.song.pattern==='block'?'ブロックコード':'分散和音'}</p><button className="secondary full" onClick={()=>edit({...createTrack(proposal.song),instrument:'piano'})}>この提案を適用する</button><small>現在の曲を置き換えます。元に戻せます。</small></div>}
  <div className="sample"><span className="pill">固定サンプル</span><h3>晴れた日の思い出</h3><p>最初は固定サンプルです。写真からの提案は別途実行してください。</p><button className="secondary full" onClick={()=>edit({...createTrack(sample),instrument:'piano'})}>サンプルを読み直す ↗</button><small>編集中の曲を置き換えます。元に戻せます。</small></div>
  </aside><section className="editor"><div className="section-top"><h2><small>02</small> 伴奏を編集</h2><span>8 BARS / 4 BEATS</span></div><div className="song-title"><div><p className="eyebrow">YOUR TRACK</p><h2>現在の伴奏 <span>↗</span></h2></div></div>
  <div className="transport"><button className="play" onClick={bar>=0||playbackStatus==='loading'?stop:play}>{playbackStatus==='loading'?'■ 読み込み中':bar>=0?'■ 停止':'▶ 再生する'}</button><div className="timeline" role="slider" tabIndex={0} aria-label="再生位置" aria-valuemin={0} aria-valuemax={31.75} aria-valuenow={cursorBeat} onClick={event=>{const rect=event.currentTarget.getBoundingClientRect();seek((event.clientX-rect.left)/rect.width*32);}} onKeyDown={event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();seek(event.key==='Home'?0:event.key==='End'?31.75:cursorBeat+(event.key==='ArrowRight'?.25:-.25));}}}><div style={{width:`${cursorBeat/32*100}%`}}/></div><span>{bar>=0?`${bar+1} / 8 小節`:`約${Math.round(32*60/song.bpm)}秒`}</span><button className="icon-button" aria-label="最初から再生" onClick={restart}>↺</button></div>
  <div className="settings"><label>テンポ <span><strong>{song.bpm}</strong> BPM</span><input aria-label="テンポ" type="range" min="60" max="160" value={song.bpm} onChange={e=>edit({...song,bpm:Number(e.target.value)})}/><div className="range-labels"><small>ゆったり 60</small><small>160 軽快に</small></div></label><label>伴奏パターン<select value={song.pattern} onChange={e=>request({...song,pattern:e.target.value as Song['pattern']})}><option value="arpeggio">分散和音 — 音をひとつずつ</option><option value="block">ブロックコード — 音を重ねて</option></select></label></div>
  <div className="chords-heading"><h3>コード進行</h3><span>各小節のコードを選んで変更</span></div><div className="chords">{song.bars.map((chord,i)=><label key={i} className={'chord '+(bar===i?'active':'')}><span>{String(i+1).padStart(2,'0')}<small>{bar===i?'演奏中':'小節'}</small></span><select aria-label={`${i+1}小節目のコード`} value={chord} onChange={e=>request({...song,bars:song.bars.map((c,j)=>j===i?e.target.value as Chord:c)},i)}>{chords.map(c=><option key={c}>{c}</option>)}</select><div className="beats">● ● ● ●</div></label>)}</div>
  <div className="edit-footer"><p>コードやテンポの変更は、次の再生から反映されます。</p><button className="text-button" disabled={!history.length} onClick={()=>{invalidate();stop();setPending(undefined);setState(s=>undo(s));}}>↶ 元に戻す</button></div>
  {pending&&<div className="regenerate" role="dialog" aria-label="音符の再生成"><p>{pending.bar===undefined?'全小節':`${pending.bar+1}小節目（開始拍がこの小節にある音符）`}の最初のトラックの音符を再生成し、対象範囲の手編集を置き換えます。追加トラックの音符は維持します。小節をまたぐ音符との重複が生じる場合は適用できません。元に戻せます。</p><button className="secondary" onClick={confirm}>再生成を適用</button> <button className="secondary" onClick={()=>setPending(undefined)}>キャンセル</button></div>}
  <p><a className="secondary" href="#/midi">MIDI編集画面を開く →</a></p>
  <div className="ai"><span className="ai-symbol">✧</span><div><h3>言葉で音楽を変える <span className="pill">準備中</span></h3><p>「後半をもっと感動的に」など、AIによる編集提案は今後接続します。</p></div></div>
  <div className="export"><div><h3>できた伴奏を、次の制作へ。</h3><p>テンポ・拍子・音符を含むMIDIを書き出せます。</p></div><button className="download" onClick={download}>↓ MIDIを書き出す</button></div>
  </section></div>{error&&<p role="alert" className="error">{error}</p>}<footer><span>PhotoChord / 写真からはじまる音楽づくり</span><span>音色はサンプル音源・内蔵シンセ · 保存はセッション内のみ</span></footer></main></>;
}
createRoot(document.getElementById('root')!).render(<App/>);
