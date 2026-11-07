import { instrumentFor, type InstrumentId } from './instruments';
export const chords = ['C', 'Cm', 'D', 'Dm', 'E', 'Em', 'F', 'Fm', 'G', 'Gm', 'A', 'Am', 'B', 'Bm'] as const;
export type Chord = typeof chords[number];
export type Song = { bpm: number; pattern: 'block' | 'arpeggio'; bars: Chord[] };
export type Part = { id: string; name: string; notes: Note[]; instrument?: InstrumentId; volume: number; muted: boolean; solo: boolean };
export type Track = Song & { notes: Note[]; instrument?: InstrumentId; name?: string; volume?: number; muted?: boolean; solo?: boolean; layers?: Part[]; photoUrls?: string[]; emotions?: Emotion[] };
export const MAX_PARTS = 8;
export type Note = { pitch: number; startBeat: number; durationBeats: number; velocity: number };
export const sample: Song = { bpm: 100, pattern: 'arpeggio', bars: ['C','G','Am','F','C','G','F','C'] };
// 感情プリセットを均等に混ぜるローカル生成。画像分析・AIは使わない。
export const emotions = ['明るい', '温かい', '穏やか', '切ない', '力強い', '幻想的'] as const;
export type Emotion = typeof emotions[number];
const emotionProfiles: Record<Emotion, Song> = {
  明るい: { bpm: 124, pattern: 'arpeggio', bars: ['C','G','F','G','C','Am','F','C'] },
  温かい: { bpm: 96, pattern: 'block', bars: ['C','Em','F','C','Am','F','G','C'] },
  穏やか: { bpm: 72, pattern: 'block', bars: ['C','F','C','G','Am','F','G','C'] },
  切ない: { bpm: 84, pattern: 'arpeggio', bars: ['Am','Em','F','C','Dm','Am','E','Am'] },
  力強い: { bpm: 144, pattern: 'block', bars: ['Am','F','C','G','Am','F','G','Am'] },
  幻想的: { bpm: 90, pattern: 'arpeggio', bars: ['Em','Am','Dm','Em','F','Am','Bm','Em'] },
};
export function songForEmotions(input: unknown): Song & { emotions: Emotion[] } {
  if (!Array.isArray(input) || input.length === 0 || input.length > emotions.length) throw new Error('感情を1つ以上選んでください。');
  const selected = emotions.filter(emotion => input.includes(emotion));
  if (selected.length !== input.length) throw new Error('感情の指定が不正、または重複しています。');
  const profiles = selected.map(emotion => emotionProfiles[emotion]);
  const song: Song & { emotions: Emotion[] } = {
    emotions: selected,
    bpm: Math.round(profiles.reduce((sum, profile) => sum + profile.bpm, 0) / profiles.length),
    pattern: profiles.filter(profile => profile.pattern === 'arpeggio').length >= profiles.length / 2 ? 'arpeggio' : 'block',
    // 各感情の進行を小節ごとに交互に使い、最後は先頭の感情の終止に戻る。
    bars: Array.from({ length: 8 }, (_, bar) => profiles[bar === 7 ? 0 : bar % profiles.length].bars[bar]),
  };
  validateSong(song);
  return song;
}
/** 写真を選択順に、小節の境界で8小節へ配分する。AIと画面で共用。 */
export function photoSections(count: number): { photo: number; startBar: number; endBar: number }[] {
  if (!Number.isInteger(count) || count < 1 || count > 5) throw new Error('写真は1〜5枚で指定してください。');
  return Array.from({ length: count }, (_, photo) => ({
    photo, startBar: Math.floor(photo * 8 / count), endBar: Math.floor((photo + 1) * 8 / count),
  }));
}
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
export function partsFor(track: Track): Part[] {
  return [{id:'main',name:track.name??'トラック1',notes:track.notes,instrument:track.instrument,volume:track.volume??1,muted:track.muted??false,solo:track.solo??false},...(track.layers??[])];
}
export function validateTrack(track: Track) {
  validateSong(track);
  const parts=partsFor(track);
  if(parts.length>MAX_PARTS || new Set(parts.map(part=>part.id)).size!==parts.length) throw new Error('トラックは最大8件で、IDは重複できません。');
  for(const part of parts) {
    if(typeof part.id!=='string' || !part.id || typeof part.name!=='string' || !part.name.trim() || part.name.length>60) throw new Error('トラック名は1〜60文字で指定してください。');
    if(!Number.isFinite(part.volume) || part.volume<0 || part.volume>1 || typeof part.muted!=='boolean' || typeof part.solo!=='boolean') throw new Error('トラックの音量・ミュート設定が不正です。');
    instrumentFor(part.instrument); validateNotes(part.notes);
  }
}
export function playbackNotes(track: Track): Note[] { validateTrack(track); return track.notes; }
export function playbackParts(track: Track): Part[] {
  validateTrack(track);
  const parts=partsFor(track), hasSolo=parts.some(part=>part.solo);
  return parts.filter(part=>!part.muted && (!hasSolo || part.solo));
}
export function updatePart(track: Track, id: string, patch: Partial<Omit<Part,'id'>>): Track {
  let next: Track;
  if(id==='main') next={...track,...patch};
  else {
    if(!track.layers?.some(part=>part.id===id)) throw new Error('対象のトラックがありません。');
    next={...track,layers:track.layers.map(part=>part.id===id?{...part,...patch}:part)};
  }
  validateTrack(next); return next;
}
export function addPart(track: Track, part: Part): Track {
  const next={...track,layers:[...(track.layers??[]),structuredClone(part)]};
  validateTrack(next); return next;
}
export function removePart(track: Track, id: string): Track {
  if(id==='main') throw new Error('最初のトラックは削除できません。空にするかミュートしてください。');
  const next={...track,layers:(track.layers??[]).filter(part=>part.id!==id)};
  validateTrack(next); return next;
}
export function createTrack(song: Song): Track { return {...structuredClone(song), notes: notesFor(song)}; }
/** AIの生成設定を、編集可能な3声の演奏に展開する。外部音声生成は使わない。 */
export function arrangeSong(song: Song): Track {
  validateSong(song);
  const melody: Note[] = [], bass: Note[] = [];
  const roots: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  let previous = 76;
  song.bars.forEach((chord, bar) => {
    const root = roots[chord[0]];
    const tones = [root, (root + (chord.endsWith('m') ? 3 : 4)) % 12, (root + 7) % 12];
    // 同じ2小節モチーフを変奏し、4・8小節目は長い音でフレーズを閉じる。
    const rhythm = bar % 4 === 3 ? [0, 1, 2] : bar % 2 === 0 ? [0, 1, 1.5, 2.5, 3] : [0, .5, 1.5, 2, 3];
    rhythm.forEach((beat, index) => {
      const tone = tones[bar === 7 && index === rhythm.length - 1 ? 0 : (index + Math.floor(bar / 2)) % 3];
      const candidates = Array.from({ length: 13 }, (_, i) => 72 + i).filter(pitch => pitch % 12 === tone);
      const target = previous + (bar % 2 === 0 ? 2 : -2);
      const pitch = candidates.reduce((best, value) => Math.abs(value - target) < Math.abs(best - target) ? value : best);
      const end = rhythm[index + 1] ?? 4;
      melody.push({ pitch, startBeat: bar * 4 + beat, durationBeats: end - beat - .08, velocity: bar >= 4 ? 92 : 84 });
      previous = pitch;
    });
    [0, 2].forEach((beat, index) => bass.push({
      pitch: 48 + (index === 0 || bar === 7 ? root : (root + 7) % 12),
      startBeat: bar * 4 + beat, durationBeats: 1.8, velocity: index === 0 ? 78 : 68,
    }));
  });
  const track: Track = {
    ...createTrack(song), name: 'コード伴奏', instrument: 'piano', volume: .65,
    layers: [
      { id: 'generated-melody', name: 'メロディー', notes: melody, instrument: 'bell', volume: .85, muted: false, solo: false },
      { id: 'generated-bass', name: 'ベース', notes: bass, instrument: 'electric', volume: .75, muted: false, solo: false },
    ],
  };
  validateTrack(track);
  return track;
}
export function replaceNote(track: Track, index: number, note?: Note): Track {
  const notes=track.notes.filter((_,i)=>i!==index);
  if(note) notes.splice(index<0?notes.length:index,0,{...note});
  validateNotes(notes); return {...track,notes};
}
// A bar owns notes whose start lies in it, including notes extending beyond it.
export function regenerate(track: Track, settings: Song, bar?: number): Track {
  const generated=notesFor(settings);
  const notes=bar===undefined?generated:[...track.notes.filter(n=>Math.floor(n.startBeat/4)!==bar),...generated.filter(n=>Math.floor(n.startBeat/4)===bar)];
  validateNotes(notes); return {...track,...settings,notes,instrument:track.instrument,layers:track.layers};
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
const u16=(n:number)=>[(n>>>8)&255,n&255];
function trackChunk(events: {tick:number;data:number[]}[]): number[] {
  const order=(status:number)=>status===0xff?0:(status&0xf0)===0xc0?1:(status&0xf0)===0xb0?2:(status&0xf0)===0x80?3:4;
  events.sort((a,b)=>a.tick-b.tick || order(a.data[0])-order(b.data[0]));
  const data:number[]=[]; let previous=0;
  for(const event of events){data.push(...vlq(event.tick-previous),...event.data);previous=event.tick;}
  data.push(...vlq(32*480-previous),0xff,0x2f,0);
  return [77,84,114,107,...u32(data.length),...data];
}
export function midiFor(song: Song | Track): Uint8Array {
  const track='notes' in song?song:createTrack(song);
  const audible=playbackParts(track);
  const tempo=Math.round(60000000/song.bpm);
  const meta=[{tick:0,data:[0xff,0x51,3,(tempo>>>16)&255,(tempo>>>8)&255,tempo&255]},{tick:0,data:[0xff,0x58,4,4,2,24,8]}];
  const multiple=partsFor(track).length>1;
  const chunks:number[][]=multiple?[trackChunk(meta)]:[];
  const all=partsFor(track);
  for(const part of audible) {
    const channel=all.findIndex(item=>item.id===part.id);
    const events:{tick:number;data:number[]}[]=multiple?[]:[...meta];
    if(multiple) {const name=[...new TextEncoder().encode(part.name)];events.push({tick:0,data:[0xff,3,...vlq(name.length),...name]});}
    events.push({tick:0,data:[0xc0|channel,instrumentFor(part.instrument).program]});
    if(multiple || part.volume!==1) events.push({tick:0,data:[0xb0|channel,7,Math.round(part.volume*127)]});
    for(const note of part.notes){
      events.push({tick:Math.round(note.startBeat*480),data:[0x90|channel,note.pitch,note.velocity]});
      events.push({tick:Math.round((note.startBeat+note.durationBeats)*480),data:[0x80|channel,note.pitch,0]});
    }
    chunks.push(trackChunk(events));
  }
  if(!chunks.length) chunks.push(trackChunk(meta));
  return new Uint8Array([77,84,104,100,0,0,0,6,0,multiple?1:0,...u16(chunks.length),1,224,...chunks.flat()]);
}
