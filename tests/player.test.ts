import test from 'node:test';
import assert from 'node:assert/strict';
import {Player} from '../src/player.ts';
import {createTrack,sample} from '../src/music.ts';
test('再生は手編集音符を予約し、音声クロックに追従、再再生と停止で古い演奏を閉じる',async()=>{
 const contexts:FakeContext[]=[];let callback:()=>void=()=>{};
 class FakeContext {
  currentTime=10;destination={};closed=false;events:{frequency:number;start:number;end:number;velocity:number}[]=[];
  constructor(){contexts.push(this);}
  async resume(){} async close(){this.closed=true;}
  createDynamicsCompressor(){return {threshold:{value:0},knee:{value:0},ratio:{value:0},connect(){}};}
  createOscillator(){const event={frequency:0,start:0,end:0,velocity:0};this.events.push(event);return {type:'',frequency:{set value(v:number){event.frequency=v;}},connect(){},start(v:number){event.start=v;},stop(v:number){event.end=v;}};}
  createGain(){const event=this.events.at(-1)!;return {gain:{setValueAtTime(){},linearRampToValueAtTime(v:number){event.velocity=v;},exponentialRampToValueAtTime(){}},connect(){}};}
 }
 const oldContext=globalThis.AudioContext,oldWindow=globalThis.window;
 Object.assign(globalThis,{AudioContext:FakeContext,window:{setInterval(fn:()=>void){callback=fn;return 1;}}});
 try{
  const player=new Player();const track={...createTrack(sample),bpm:120,notes:[{pitch:52,startBeat:2.25,durationBeats:2,velocity:78}]};let position=-1;
  await player.play(track,p=>position=p);const first=contexts[0];
  assert.deepEqual(first.events,[{frequency:440*2**((52-69)/12),start:11.205,end:12.225,velocity:78/127*.12}]);
  first.currentTime=12.08;callback();assert.ok(Math.abs(position-4)<1e-9);
  await player.play(track,p=>position=p);assert.equal(first.closed,true);player.stop();assert.equal(contexts[1].closed,true);
  const a=player.play(track,()=>{}),b=player.play({...track,notes:[]},p=>position=p);await Promise.all([a,b]);assert.equal(contexts[2].events.length,0);assert.equal(contexts[2].closed,true);assert.equal(contexts[3].events.length,0);
  contexts[3].currentTime=26.09;callback();assert.equal(position,-1);assert.equal(contexts[3].closed,true);
 }finally{Object.assign(globalThis,{AudioContext:oldContext,window:oldWindow});}
});
