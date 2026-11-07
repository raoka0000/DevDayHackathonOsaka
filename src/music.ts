import { instrumentFor, type InstrumentId } from './instruments';
export const chords = ['C', 'Cm', 'D', 'Dm', 'E', 'Em', 'F', 'Fm', 'G', 'Gm', 'A', 'Am', 'B', 'Bm'] as const;
export type Chord = typeof chords[number];
export type Song = { bpm: number; pattern: 'block' | 'arpeggio'; bars: Chord[] };
export type Track = Song & { notes: Note[]; instrument?: InstrumentId };
export type Note = { pitch: number; startBeat: number; durationBeats: number; velocity: number };
export const sample: Song = { bpm: 100, pattern: 'arpeggio', bars: ['C','G','Am','F','C','G','F','C'] };
export function validateSong(song: Song) {
  if (!Number.isInteger(song.bpm) || song.bpm < 60 || song.bpm > 160 || !['block','arpeggio'].includes(song.pattern) || song.bars.length !== 8 || song.bars.some(c => !chords.includes(c))) throw new Error('曲の設定が不正です。');
}
export function notesFor(song: Song): Note[] {
  validateSong(song);
  const roots: Record<string, number> = {C:60,D:62,E:64,F:65,G:67,A:69,B:71};
  return song.bars.flatMap((chord, bar) => {
    const root = roots[chord[0]];
    const pitches = [root, root + (chord.endsWith('m') ? 3 : 4), root + 7];
    return song.pattern === 'block'
      ? pitches.map(pitch => ({pitch, startBeat:bar*4, durationBeats:3.8, velocity:78}))
      : Array.from({length:8}, (_,i) => ({pitch:pitches[[0,1,2,1,0,1,2,1][i]], startBeat:bar*4+i/2, durationBeats:0.45, velocity:i%2 ? 65:82}));
  });
}
export function validateNotes(notes: Note[]) {
  for (const n of notes) {
    if (!Number.isInteger(n.pitch) || n.pitch < 48 || n.pitch > 84) throw new Error('音高は48〜84の整数で指定してください。');
    if (!Number.isFinite(n.startBeat) || n.startBeat < 0 || n.startBeat >= 32 || !Number.isFinite(n.durationBeats) || n.durationBeats < .25 || n.startBeat+n.durationBeats > 32) throw new Error('開始拍は0以上、長さは0.25拍以上、終端は32拍以下にしてください。');
    if (!Number.isInteger(n.velocity) || n.velocity < 1 || n.velocity > 127) throw new Error('ベロシティは1〜127の整数にしてください。');
  }
  for (let i=0;i<notes.length;i++) for(let j=0;j<i;j++) {
    const a=notes[i], b=notes[j];
    if(a.pitch===b.pitch && a.startBeat < b.startBeat+b.durationBeats && b.startBeat < a.startBeat+a.durationBeats) throw new Error('同じ音高の音符を重ねることはできません。');
  }
}
export function playbackNotes(track: Track): Note[] { validateSong(track); instrumentFor(track.instrument); validateNotes(track.notes); return track.notes; }
export function createTrack(song: Song): Track { return {...structuredClone(song), notes: notesFor(song)}; }
export function replaceNote(track: Track, index: number, note?: Note): Track {
  const notes=track.notes.filter((_,i)=>i!==index);
  if(note) notes.splice(index<0?notes.length:index,0,{...note});
  validateNotes(notes); return {...track,notes};
}
// A bar owns notes whose start lies in it, including notes extending beyond it.
export function regenerate(track: Track, settings: Song, bar?: number): Track {
  const generated=notesFor(settings);
  const notes=bar===undefined?generated:[...track.notes.filter(n=>Math.floor(n.startBeat/4)!==bar),...generated.filter(n=>Math.floor(n.startBeat/4)===bar)];
  validateNotes(notes); return {...settings,notes,instrument:track.instrument};
}
export type EditorState = { current: Track; history: Track[] };
export function commit(state: EditorState, next: Track): EditorState {
  playbackNotes(next);
  if(JSON.stringify(state.current)===JSON.stringify(next)) return state;
  return {current:next,history:[...state.history.slice(-29),state.current]};
}
export function undo(state: EditorState): EditorState { return state.history.length ? {current:state.history.at(-1)!,history:state.history.slice(0,-1)} : state; }
const u32 = (n:number) => [(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255];
const vlq = (n:number) => { const bytes=[n&127]; while ((n >>>= 7)) bytes.unshift((n&127)|128); return bytes; };
export function midiFor(song: Song | Track): Uint8Array {
  const events = ('notes' in song ? playbackNotes(song) : notesFor(song)).flatMap(n => [
    {tick:Math.round(n.startBeat*480), data:[0x90,n.pitch,n.velocity]},
    {tick:Math.round((n.startBeat+n.durationBeats)*480), data:[0x80,n.pitch,0]}
  ]).sort((a,b)=>a.tick-b.tick || a.data[0]-b.data[0]);
  const tempo=Math.round(60000000/song.bpm);
  const track=[0,0xff,0x51,3,(tempo>>>16)&255,(tempo>>>8)&255,tempo&255,0,0xff,0x58,4,4,2,24,8,0,0xc0,instrumentFor('notes' in song ? song.instrument : undefined).program];
  let previous=0;
  for(const event of events) { track.push(...vlq(event.tick-previous),...event.data); previous=event.tick; }
  track.push(...vlq(32*480-previous),0xff,0x2f,0);
  return new Uint8Array([77,84,104,100,0,0,0,6,0,0,0,1,1,224,77,84,114,107,...u32(track.length),...track]);
}
