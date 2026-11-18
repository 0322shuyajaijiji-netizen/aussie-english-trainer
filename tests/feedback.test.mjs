import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code=fs.readFileSync(new URL('../feedback.js',import.meta.url),'utf8');
function setup({audio=true}={}){
 const timers=new Map(),events=[],notes=[];let id=0;
 class AudioContext{
  constructor(){this.state='suspended';this.currentTime=0;this.destination={};}resume(){this.state='running';return Promise.resolve();}
  createOscillator(){return {frequency:{setValueAtTime:hz=>notes.push(hz)},connect(){},disconnect(){},start(){},stop(){}};}
  createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}
 }
 const ctx={setTimeout:(fn,ms)=>{timers.set(++id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id)};if(audio)ctx.AudioContext=AudioContext;ctx.window=ctx;
 vm.createContext(ctx);vm.runInContext(code,ctx);
 const feedback=ctx.AussieFeedback.create({show:data=>events.push(data),hide:()=>events.push('hide')});
 return {feedback,timers,events,notes};
}
test('○は高い二音、×は低い二音をブラウザ内で生成する',()=>{
 const b=setup();b.feedback.prime();b.feedback.present(true);assert.equal(b.events.at(-1).symbol,'○');assert.deepEqual(b.notes,[660,880]);b.feedback.present(false);assert.equal(b.events.at(-1).symbol,'×');assert.deepEqual(b.notes.slice(-2),[200,150]);
});
test('操作不要で判定を消去し、正解後のコールバックを実行',()=>{
 const b=setup();let done=0;b.feedback.present(true,()=>done++);const t=[...b.timers.values()][0];assert.equal(t.ms,1100);t.fn();assert.equal(b.events.at(-1),'hide');assert.equal(done,1);
});
test('画面移動や再挑戦でキャンセルした後、古いタイマーは次へ進めない',()=>{
 const b=setup();let done=0;b.feedback.present(true,()=>done++);const old=[...b.timers.values()][0];b.feedback.cancel();old.fn();assert.equal(done,0);assert.equal(b.timers.size,0);
});
test('音声出力非対応でも○×と自動消去は動作する',()=>{
 const b=setup({audio:false});assert.doesNotThrow(()=>b.feedback.prime());b.feedback.present(false);assert.equal(b.events.at(-1).symbol,'×');[...b.timers.values()][0].fn();assert.equal(b.events.at(-1),'hide');
});
test('ユーザー操作での準備前には効果音を再生しない',()=>{
 const b=setup();b.feedback.present(true);assert.equal(b.notes.length,0);b.feedback.prime();b.feedback.present(true);assert.equal(b.notes.length,2);
});
