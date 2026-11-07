import test from 'node:test';
import assert from 'node:assert/strict';
import { midiFor, notesFor, sample, validateSong } from '../src/music.ts';
test('8小節のコードと音域、パターンを音符に反映する',()=>{
 const block=notesFor({...sample,pattern:'block'});
 assert.equal(block.length,24);assert.deepEqual(block.slice(0,3).map(n=>n.pitch),[60,64,67]);
 assert.equal(block.at(-1)?.startBeat,28);
 assert.equal(notesFor(sample).length,64);
 assert.deepEqual(notesFor({...sample,pattern:'block',bars:['Cm',...sample.bars.slice(1)]}).slice(0,3).map(n=>n.pitch),[60,63,67]);
 assert.ok(notesFor(sample).every(n=>n.startBeat+n.durationBeats<=32));
});
test('範囲外のテンポ・小節数・コードを拒否する',()=>{
 for(const bpm of [59,161,NaN,100.5])assert.throws(()=>validateSong({...sample,bpm}));
 assert.throws(()=>validateSong({...sample,bars:[]}));
 assert.throws(()=>validateSong({...sample,bars:Array(8).fill('X')}));
});
test('MIDIを解析し、全音符・テンポ・拍子・32拍を確認する',()=>{
 const bytes=midiFor(sample);assert.equal(new TextDecoder().decode(bytes.slice(0,4)),'MThd');
 const length=new DataView(bytes.buffer).getUint32(18);assert.equal(length,bytes.length-22);
 let i=22,tick=0;const on:{tick:number,pitch:number,velocity:number}[]=[],off:{tick:number,pitch:number}[]=[];
 function variable(){let n=0,b;do{b=bytes[i++];n=(n<<7)|(b&127);}while(b&128);return n;}
 while(i<bytes.length){tick+=variable();const status=bytes[i++];if(status===255){const type=bytes[i++],len=variable();const data=bytes.slice(i,i+len);i+=len;if(type===81)assert.equal(data[0]*65536+data[1]*256+data[2],600000);if(type===88)assert.deepEqual([...data],[4,2,24,8]);if(type===47)assert.equal(tick,32*480);}else if(status===192)i++;else{const pitch=bytes[i++],velocity=bytes[i++];if(status===144)on.push({tick,pitch,velocity});else if(status===128)off.push({tick,pitch});else assert.fail('未知のイベント');}}
 const notes=notesFor(sample);assert.deepEqual(on,notes.map(n=>({tick:Math.round(n.startBeat*480),pitch:n.pitch,velocity:n.velocity})));
 assert.deepEqual(off,notes.map(n=>({tick:Math.round((n.startBeat+n.durationBeats)*480),pitch:n.pitch})));
});
