import { instrumentFor } from './instruments';
import { playbackParts, type Track } from './music';
import { sampleFor } from './soundfont';
export type PlaybackStatus = 'ready' | 'loading';
export class Player {
  private context?: AudioContext;
  private timer?: number;
  private startedAt?: number;
  private offsetBeat=0;
  private secondsPerBeat=.6;
  currentBeat() {
    return this.context && this.startedAt!==undefined
      ? Math.min(32,Math.max(this.offsetBeat,this.offsetBeat+(this.context.currentTime-this.startedAt)/this.secondsPerBeat))
      : this.offsetBeat;
  }
  stop() { this.startedAt=undefined; clearInterval(this.timer); if(this.context) void this.context.close().catch(()=>{}); this.context=undefined; }
  async play(song: Track, position: (beat:number)=>void, status: (value:PlaybackStatus)=>void = ()=>{}, fromBeat=0) {
    if(!Number.isFinite(fromBeat)||fromBeat<0||fromBeat>=32) throw new Error('再生位置は0以上32拍未満で指定してください。');
    const parts=playbackParts(song).map(part=>({...part,notes:part.notes.filter(note=>note.startBeat+note.durationBeats>fromBeat)}));
    this.stop();
    this.offsetBeat=fromBeat;
    const ctx = new AudioContext(); this.context=ctx;
    try {
      await ctx.resume();
      if(this.context!==ctx) return;
      const samples = new Map<string,AudioBuffer>();
      await Promise.all(parts.map(async part=>{
        const instrument=instrumentFor(part.instrument);
        if ('file' in instrument && part.notes.length && part.volume>0) {
          status('loading');
          await Promise.all([...new Set(part.notes.map(note=>note.pitch))].map(async pitch=>{
            samples.set(`${instrument.file}:${pitch}`,await sampleFor(ctx,instrument.file,pitch));
          }));
        }
      }));
      if(this.context!==ctx) return;
      status('ready');
      const start=ctx.currentTime+0.08, beat=60/song.bpm;
      this.startedAt=start; this.secondsPerBeat=beat;
      position(fromBeat);
      // All sources share the same clock; a compressor prevents layered peaks clipping.
      const master=ctx.createDynamicsCompressor();
      master.threshold.value=-12; master.knee.value=12; master.ratio.value=4;
      master.connect(ctx.destination);
      for(const part of parts) {
        if(part.volume===0) continue;
        const instrument=instrumentFor(part.instrument);
        for(const note of part.notes) {
          const skippedBeats=Math.max(0,fromBeat-note.startBeat);
          const time=start+(Math.max(note.startBeat,fromBeat)-fromBeat)*beat, duration=(note.durationBeats-skippedBeats)*beat;
          const peak=note.velocity/127*instrument.level*part.volume;
          if ('file' in instrument) {
            const gain=ctx.createGain(), source=ctx.createBufferSource();
            const buffer=samples.get(`${instrument.file}:${note.pitch}`);
            if (!buffer) throw new Error('音符に対応する音源を読み込めませんでした。');
            const offset=skippedBeats*beat;
            if(offset>=buffer.duration) continue;
            source.buffer=buffer;
            gain.gain.setValueAtTime(0,time);
            gain.gain.linearRampToValueAtTime(peak,time+Math.min(.008,duration*.3));
            gain.gain.setValueAtTime(peak,time+Math.max(Math.min(.008,duration*.3),duration-.025));
            gain.gain.linearRampToValueAtTime(0,time+duration);
            source.connect(gain); gain.connect(master);
            source.start(time,offset); source.stop(time+duration+.02);
          } else {
            const osc=ctx.createOscillator(), gain=ctx.createGain();
            osc.type=instrument.wave; osc.frequency.value=440*2**((note.pitch-69)/12);
            const attack=Math.min(instrument.attack,duration*.3);
            gain.gain.setValueAtTime(0,time);
            gain.gain.linearRampToValueAtTime(peak,time+attack);
            gain.gain.exponentialRampToValueAtTime(Math.max(.00001,peak*instrument.sustain),time+duration*.8);
            gain.gain.exponentialRampToValueAtTime(.00001,time+duration);
            osc.connect(gain); gain.connect(master); osc.start(time); osc.stop(time+duration+.02);
          }
        }
      }
      this.timer=window.setInterval(()=>{
        if(this.context!==ctx) return;
        const current=this.currentBeat();
        if(current>=32) {this.stop(); position(-1);} else position(current);
      },50);
    } catch (reason) {
      if (this.context!==ctx) return;
      this.stop(); status('ready'); throw reason;
    }
  }
}
