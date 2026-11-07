import type { Track } from '../music';
import { PianoRoll } from './PianoRoll';
import './midi.css';

// The app owns the song, history and player. This screen only edits through callbacks.
export type MidiEditorScreenProps = {
  track: Track;
  beat: number;
  canUndo: boolean;
  error: string;
  onEdit: (track: Track) => void;
  onStart: () => void;
  onPlay: () => Promise<void>;
  onUndo: () => void;
  onDownload: () => void;
};

export function MidiEditorScreen({
  track, beat, canUndo, error, onEdit, onStart, onPlay, onUndo, onDownload,
}: MidiEditorScreenProps) {
  return <main className="midi-screen">
    <nav className="midi-navigation" aria-label="画面移動">
      <a href="#/">← 写真・コード編集に戻る</a>
      <span>PhotoChord · MIDI編集</span>
    </nav>
    <div className="midi-heading">
      <div>
        <p className="eyebrow">MIDI EDITOR</p>
        <h1>MIDI編集</h1>
        <p>音符の高さ・位置・長さを編集できます。写真・コード編集と同じ曲を使います。</p>
      </div>
      <span className="pill">固定サンプルから編集中</span>
    </div>
    <section className="midi-panel" aria-label="MIDI編集ワークスペース">
      <div className="midi-toolbar">
        <button className="play" onClick={beat>=0?onStart:onPlay}>
          {beat>=0?'■ 停止':'▶ 再生する'}
        </button>
        <button className="secondary" onClick={onPlay}>最初から再生</button>
        <span aria-live="off">{track.bpm} BPM · 4/4 · {beat>=0?`${Math.floor(beat/4)+1} / 8 小節`:'8小節'}</span>
        <button className="secondary" disabled={!canUndo} onClick={onUndo}>↶ 元に戻す</button>
        <button className="download" onClick={onDownload}>↓ MIDIを書き出す</button>
      </div>
      <PianoRoll track={track} beat={beat} onEdit={onEdit} onStart={onStart}/>
      {error&&<p role="alert" className="error">{error}</p>}
    </section>
    <p className="midi-session-note">画面を移動しても編集内容とUndo履歴は引き継ぎます。再読み込みすると消えるため、必要な結果はMIDIで書き出してください。</p>
  </main>;
}
