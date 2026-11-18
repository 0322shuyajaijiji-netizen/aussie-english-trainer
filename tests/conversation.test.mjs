import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const code=fs.readFileSync(new URL('../conversation.js',import.meta.url),'utf8');
function setup(kinds=['partner','user','partner','user']){
 const timers=new Map(),states=[],plays=[],listens=[],checks=[],advanced=[];let serial=0,index=0,completed=0,halts=0;
 const root={setTimeout:(fn,ms)=>{const id=++serial;timers.set(id,{fn:()=>{timers.delete(id);fn();},ms});return id;},clearTimeout:id=>timers.delete(id)};
 root.window=root;vm.createContext(root);vm.runInContext(code,root);
 const turns=kinds.map((kind,i)=>({kind,text:'partner '+i,expected:'user '+i}));
 const controller=root.AussieConversation.create({
  getTurn:()=>turns[index]||null,
  play:(text,done,fail)=>plays.push({text,done,fail}),
  listen:(expected,result,fail)=>{listens.push({expected,result,fail});return true;},
  judge:(turn,text)=>({correct:text===turn.expected}),
  feedback:(correct,done)=>checks.push({correct,done}),
  advance:(turn,result)=>{advanced.push({turn,result});index++;},
  complete:()=>completed++,onState:s=>states.push(s),halt:()=>halts++
 });
 const tick=ms=>[...timers.values()].find(t=>t.ms===ms)?.fn();
 return {controller,states,plays,listens,checks,advanced,timers,tick,get index(){return index;},get completed(){return completed;},get halts(){return halts;}};
}
test('自分がAならスタートと同じ呼び出しでマイク入力を開始',()=>{
 const b=setup(['user','partner']);b.controller.start();assert.equal(b.listens.length,1);assert.equal(b.plays.length,0);assert.equal(b.controller.getPhase(),'user');
});
test('自分がBなら相手音声を再生し、終了までマイクを開始しない',()=>{
 const b=setup();b.controller.start();assert.equal(b.plays.length,1);assert.equal(b.listens.length,0);b.plays[0].done();assert.equal(b.listens.length,0);b.tick(300);assert.equal(b.listens.length,1);
});
test('一致したら判定音の後に次の相手役へ自動で進む',()=>{
 const b=setup(['user','partner']);b.controller.start();b.listens[0].result('user 0');assert.equal(b.checks[0].correct,true);assert.equal(b.plays.length,0);b.checks[0].done();assert.equal(b.plays.length,1);assert.equal(b.index,1);
});
test('不一致なら同じ番で自動的に聞き直し、進捗を進めない',()=>{
 const b=setup(['user','partner']);b.controller.start();b.listens[0].result('wrong');b.checks[0].done();assert.equal(b.index,0);assert.equal(b.listens.length,2);assert.equal(b.plays.length,0);
});
test('一回のスタートで全ターンを完走し、最後に完了コールバック',()=>{
 const b=setup();b.controller.start();b.plays[0].done();b.tick(300);b.listens[0].result('user 1');b.checks[0].done();b.plays[1].done();b.tick(300);b.listens[1].result('user 3');b.checks[1].done();assert.equal(b.completed,1);assert.equal(b.controller.getPhase(),'complete');assert.equal(b.controller.isRunning(),false);
});
test('最後が相手役ならその音声の完了まで達成表示を出さない',()=>{
 const b=setup(['user','partner']);b.controller.start();b.listens[0].result('user 0');b.checks[0].done();assert.equal(b.completed,0);b.plays[0].done();b.tick(300);assert.equal(b.completed,1);
});
test('一時停止で音声・マイクを停止し、再開は同じ番から',()=>{
 const b=setup(['user','partner']);b.controller.start();b.controller.pause();assert.equal(b.halts,1);assert.equal(b.controller.getPhase(),'paused');b.controller.start();assert.equal(b.listens[1].expected,'user 0');
});
test('再生中の一時停止後に古いonendが届いても進まない',()=>{
 const b=setup();b.controller.start();b.controller.pause();b.plays[0].done();b.tick(300);assert.equal(b.index,0);assert.equal(b.listens.length,0);
});
test('画面移動でcancel後の認識・判定・タイマーは無効',()=>{
 const b=setup(['user','partner']);b.controller.start();b.listens[0].result('user 0');b.controller.cancel();b.checks[0].done();assert.equal(b.index,0);assert.equal(b.plays.length,0);assert.equal(b.controller.isRunning(),false);
});
test('マイク拒否・音声再生失敗は一時停止し、無限再試行しない',()=>{
 const a=setup(['user']);a.controller.start();a.listens[0].fail('permission denied');assert.equal(a.controller.getPhase(),'paused');assert.equal(a.listens.length,1);
 const b=setup(['partner']);b.controller.start();b.plays[0].fail('cannot play');assert.equal(b.controller.getPhase(),'paused');assert.equal(b.completed,0);
});
test('再生終了イベントが来ない場合のタイムアウトは一時停止',()=>{
 const b=setup(['partner']);b.controller.start();b.tick(45000);assert.equal(b.controller.getPhase(),'paused');assert.equal(b.listens.length,0);
});
test('スタート・認識結果・音声終了・判定終了の重複で二重に進まない',()=>{
 const b=setup(['partner','user']);b.controller.start();assert.equal(b.controller.start(),false);b.plays[0].done();b.plays[0].done();b.tick(300);b.listens[0].result('user 1');b.listens[0].result('user 1');assert.equal(b.checks.length,1);b.checks[0].done();b.checks[0].done();assert.equal(b.completed,1);assert.equal(b.advanced.length,2);
});
