import { playbackNotes, type Track } from './music';
export class Player {
  private context?: AudioContext;
  private timer?: number;
  stop() { clearInterval(this.timer); if(this.context) void this.context.close().catch(()=>{}); this.context=undefined; }
  async play(song: Track, position: (beat:number)=>void) {
    const notes=playbackNotes(song);
    this.stop();
    const ctx = new AudioContext(); this.context=ctx;
    await ctx.resume();
    if(this.context!==ctx) return;
    const start=ctx.currentTime+0.08, beat=60/song.bpm;
    for(const note of notes) {
      const osc=ctx.createOscillator(), gain=ctx.createGain();
      osc.type='triangle'; osc.frequency.value=440*2**((note.pitch-69)/12);
      const time=start+note.startBeat*beat, duration=note.durationBeats*beat;
      gain.gain.setValueAtTime(0,time);
      gain.gain.linearRampToValueAtTime(note.velocity/127*0.12,time+0.012);
      gain.gain.exponentialRampToValueAtTime(0.001,time+duration);
      osc.connect(gain); gain.connect(ctx.destination); osc.start(time); osc.stop(time+duration+0.02);
    }
    this.timer=window.setInterval(()=>{
      const elapsed=ctx.currentTime-start;
      if(elapsed>=32*beat) {this.stop(); position(-1);} else position(Math.max(0,elapsed/beat));
    },50);
  }
}
