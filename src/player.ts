import { instrumentFor } from './instruments';
import { playbackNotes, type Track } from './music';
import { sampleFor } from './soundfont';
export type PlaybackStatus = 'ready' | 'loading';
export class Player {
  private context?: AudioContext;
  private timer?: number;
  stop() { clearInterval(this.timer); if(this.context) void this.context.close().catch(()=>{}); this.context=undefined; }
  async play(song: Track, position: (beat:number)=>void, status: (value:PlaybackStatus)=>void = ()=>{}) {
    const notes=playbackNotes(song);
    const instrument=instrumentFor(song.instrument);
    this.stop();
    const ctx = new AudioContext(); this.context=ctx;
    try {
      await ctx.resume();
      if(this.context!==ctx) return;
      const samples = new Map<number,AudioBuffer>();
      if ('file' in instrument && notes.length) {
        status('loading');
        await Promise.all([...new Set(notes.map(note=>note.pitch))].map(async pitch=>{
          samples.set(pitch,await sampleFor(ctx,instrument.file,pitch));
        }));
      }
      if(this.context!==ctx) return;
      status('ready');
      const start=ctx.currentTime+0.08, beat=60/song.bpm;
      for(const note of notes) {
        const time=start+note.startBeat*beat, duration=note.durationBeats*beat;
        const peak=note.velocity/127*instrument.level;
        if ('file' in instrument) {
          const gain=ctx.createGain();
          const source=ctx.createBufferSource();
          const buffer=samples.get(note.pitch);
          if (!buffer) throw new Error('音符に対応する音源を読み込めませんでした。');
          source.buffer=buffer;
          gain.gain.setValueAtTime(0,time);
          gain.gain.linearRampToValueAtTime(peak,time+.008);
          gain.gain.setValueAtTime(peak,time+Math.max(.008,duration-.025));
          gain.gain.linearRampToValueAtTime(0,time+duration);
          source.connect(gain); gain.connect(ctx.destination);
          source.start(time); source.stop(time+duration+.02);
        } else {
          const osc=ctx.createOscillator(), gain=ctx.createGain();
          osc.type=instrument.wave; osc.frequency.value=440*2**((note.pitch-69)/12);
          const attack=Math.min(instrument.attack,duration*.3);
          gain.gain.setValueAtTime(0,time);
          gain.gain.linearRampToValueAtTime(peak,time+attack);
          gain.gain.exponentialRampToValueAtTime(Math.max(.001,peak*instrument.sustain),time+duration*.8);
          gain.gain.exponentialRampToValueAtTime(0.001,time+duration);
          osc.connect(gain); gain.connect(ctx.destination); osc.start(time); osc.stop(time+duration+.02);
        }
      }
      this.timer=window.setInterval(()=>{
        const elapsed=ctx.currentTime-start;
        if(elapsed>=32*beat) {this.stop(); position(-1);} else position(Math.max(0,elapsed/beat));
      },50);
    } catch (reason) {
      if (this.context!==ctx) return;
      this.stop(); status('ready'); throw reason;
    }
  }
}
