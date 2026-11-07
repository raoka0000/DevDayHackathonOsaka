import test from 'node:test';
import assert from 'node:assert/strict';
import {createTrack, sample, replaceNote, validateNotes, regenerate, commit, undo, playbackNotes, midiFor, type Note} from '../src/music.ts';
const n:Note={pitch:50,startBeat:1.25,durationBeats:1.5,velocity:78};
test('追加・移動・長さ変更・削除を一回ずつUndoし、元データを保持する',()=>{
 const track=createTrack(sample), original=structuredClone(track);
 let state={current:track,history:[] as typeof track[]};
 const edits=[replaceNote(track,-1,n)];
 edits.push(replaceNote(edits[0],64,{...n,pitch:51,startBeat:2}));
 edits.push(replaceNote(edits[1],64,{...n,pitch:51,startBeat:2,durationBeats:2}));
 edits.push(replaceNote(edits[2],64));
 for(const next of edits)state=commit(state,next);
 assert.equal(state.history.length,4);
 for(let i=2;i>=0;i--){state=undo(state);assert.deepEqual(state.current,edits[i]);}
 state=undo(state);assert.deepEqual(state.current,original);
 assert.equal(commit(state,state.current),state); // 選択・取消・未確定ドラフトはcommitしない
 assert.deepEqual(track,original);
 assert.equal(track.notes[0].durationBeats,.45);
 assert.equal(createTrack({...sample,pattern:'block'}).notes[0].durationBeats,3.8);
 assert.equal(replaceNote(track,0,{...track.notes[0],startBeat:.25}).notes[0].durationBeats,.45);
});
test('データ境界で不正値・同音高重複を拒否し、和音と隣接音を許可する',()=>{
 for(const patch of [{pitch:47},{pitch:85},{pitch:60.1},{pitch:NaN},{startBeat:-.25},{startBeat:Infinity},{durationBeats:0},{durationBeats:.1},{durationBeats:-1},{durationBeats:NaN},{startBeat:31,durationBeats:2},{velocity:0},{velocity:128},{velocity:1.2},{velocity:Infinity}]) assert.throws(()=>validateNotes([{...n,...patch}]));
 assert.throws(()=>validateNotes([n,{...n,startBeat:2}]));
 validateNotes([n,{...n,pitch:51},{...n,startBeat:2.75}]);
 const track=createTrack(sample);assert.throws(()=>replaceNote(track,-1,track.notes[0]));assert.equal(track.notes.length,64);
});
test('テンポは音符を保持し、再生成は開始位置が対象小節にある音符のみ置換する',()=>{
 const track=replaceNote(createTrack(sample),0,{pitch:48,startBeat:0,durationBeats:1,velocity:78});
 const changed=regenerate(track,{...track,bars:['Cm',...track.bars.slice(1)]},0);
 assert.deepEqual(changed.notes.filter(n=>n.startBeat>=4),track.notes.filter(n=>n.startBeat>=4));
 assert.equal(changed.bars[0],'Cm');assert.equal(changed.notes.some(n=>n.pitch===48),false);
 const state={current:track,history:[]};assert.deepEqual(undo(commit(state,changed)),state);
 assert.deepEqual(playbackNotes({...track,bpm:120}),track.notes);
 assert.equal(regenerate(track,{...track,pattern:'block'}).notes.length,24);
 const crossing=replaceNote({...track,notes:track.notes.filter(n=>n.pitch!==67)},-1,{pitch:67,startBeat:3.75,durationBeats:1,velocity:78});
 assert.throws(()=>regenerate(crossing,{...crossing,pattern:'block'},1));
});
function parse(bytes:Uint8Array){
 let i=22,tick=0; const on:number[][]=[],off:number[][]=[];let tempo=0,end=0;let signature:number[]=[];
 function vlq(){let n=0,b;do{b=bytes[i++];n=(n<<7)|(b&127);}while(b&128);return n;}
 while(i<bytes.length){tick+=vlq();const status=bytes[i++];if(status===255){const type=bytes[i++],len=vlq();const data=[...bytes.slice(i,i+len)];i+=len;if(type===81)tempo=data[0]*65536+data[1]*256+data[2];if(type===88)signature=data;if(type===47)end=tick;}else if(status===192)i++;else{const pitch=bytes[i++],velocity=bytes[i++];(status===144?on:off).push(status===144?[tick,pitch,velocity]:[tick,pitch]);}}
 return {on,off,tempo,signature,end};
}
test('手編集・削除後の再生データとMIDIの全イベント、無音32拍を照合する',()=>{
 let track={...createTrack(sample),notes:[] as Note[],bpm:120};
 track=replaceNote(track,-1,n);track=replaceNote(track,-1,{pitch:60,startBeat:0,durationBeats:.45,velocity:82});
 track=replaceNote(track,0,{...n,pitch:52,startBeat:2.25,durationBeats:2});
 track=replaceNote(track,1);
 assert.deepEqual(playbackNotes(track),[{pitch:52,startBeat:2.25,durationBeats:2,velocity:78}]);
 assert.deepEqual(parse(midiFor(track)),{on:[[1080,52,78]],off:[[2040,52]],tempo:500000,signature:[4,2,24,8],end:15360});
 track=replaceNote(track,0);assert.deepEqual(playbackNotes(track),[]);
 assert.deepEqual(parse(midiFor(track)),{on:[],off:[],tempo:500000,signature:[4,2,24,8],end:15360});
});
