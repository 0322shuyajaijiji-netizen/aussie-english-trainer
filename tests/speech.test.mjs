import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
const source=name=>fs.readFileSync(fileURLToPath(new URL('../'+name,import.meta.url)),'utf8');
function setup({unsupported=false,insecure=false,startThrows=false}={}){
 const recognizers=[],states=[],outputs=[],timers=new Map();let id=0;
 class Recognition{
  constructor(){recognizers.push(this);}start(){if(startThrows)throw Error('busy');this.started=true;}
  stop(){this.stopped=true;}abort(){this.aborted=true;}
 }
 const ctx={console,isSecureContext:!insecure,setTimeout:(fn,ms)=>{timers.set(++id,{fn,ms});return id;},clearTimeout:i=>timers.delete(i)};
 if(!unsupported)ctx.webkitSpeechRecognition=Recognition;
 ctx.window=ctx;vm.createContext(ctx);vm.runInContext(source('core.js'),ctx);vm.runInContext(source('speech.js'),ctx);
 const api=ctx.AussieSpeech.create({onState:s=>states.push(s)});
 const start=(options={})=>api.start({expected:'How’s it going?',onResult:t=>outputs.push(t),...options});
 const result=(text,final=true)=>{const row=[{transcript:text}];row.isFinal=final;return row;};
 const last=()=>states.at(-1);
 return {api,start,recognizers,states,outputs,timers,last,result};
}
test('WebKitでも操作と同じ呼び出し内で開始、実際のonstartから聞き取り状態',()=>{
 const b=setup();assert.equal(b.start(),true);const r=b.recognizers[0];assert.equal(r.started,true);assert.equal(r.interimResults,true);assert.equal(r.maxAlternatives,5);assert.equal(b.last().phase,'starting');r.onstart();assert.equal(b.last().phase,'listening');assert.ok([...b.timers.values()].some(t=>t.ms===30000));
});
test('二重開始を防ぎ、失敗後に再試行できる',()=>{
 const b=setup();b.start();assert.equal(b.start(),false);assert.equal(b.recognizers.length,1);b.recognizers[0].onerror({error:'not-allowed'});assert.equal(b.api.isActive(),false);assert.match(b.last().message,/許可/);assert.equal(b.start(),true);
});
test('stopで途中結果を捨てず遅れて届く最終結果を待つ',()=>{
 const b=setup();b.start();const r=b.recognizers[0];r.onstart();r.onresult({results:[b.result('How is it',false)]});b.api.stop();assert.equal(r.stopped,true);assert.notEqual(r.aborted,true);assert.equal(b.outputs.length,0);r.onresult({results:[b.result('How is it going')]});r.onend();assert.deepEqual(b.outputs,['How is it going']);
});
test('onendで途中認識だけの場合も結果を利用する',()=>{
 const b=setup();b.start();const r=b.recognizers[0];r.onresult({results:[b.result('How is it going',false)]});r.onend();assert.deepEqual(b.outputs,['How is it going']);
});
test('複数の認識区間と候補を処理し、実際に返された一致候補を選ぶ',()=>{
 const b=setup();b.start();const r=b.recognizers[0];const first=[{transcript:'House'},{transcript:'How is'}];first.isFinal=true;r.onresult({results:[first,b.result('it going')]});r.onend();assert.deepEqual(b.outputs,['How is it going']);
});
test('部分的な確定と途中結果が混在しても後半を取りこぼさない',()=>{
 const b=setup();b.start();const r=b.recognizers[0];r.onresult({results:[b.result('How is'),b.result('it going',false)]});r.onend();assert.deepEqual(b.outputs,['How is it going']);
});
test('全く一致しない発話も結果として返し、再挑戦に使える',()=>{
 const b=setup();b.start();const r=b.recognizers[0];r.onresult({results:[b.result('Sorry')]});r.onend();assert.deepEqual(b.outputs,['Sorry']);
});
test('画面移動でcancel後の遅延イベントとタイマーは結果を返さない',()=>{
 const b=setup();b.start();const r=b.recognizers[0],late=r.onresult,end=r.onend;b.api.cancel();late({results:[b.result('How is it going')]});end();assert.equal(b.outputs.length,0);assert.equal(b.timers.size,0);assert.equal(r.aborted,true);
});
test('en-AU非対応時は次のユーザー操作でen-USへ切替、日本語はja-JP',()=>{
 const b=setup();b.start();b.recognizers[0].onerror({error:'language-not-supported'});assert.match(b.last().message,/もう一度/);b.start();assert.equal(b.recognizers[1].lang,'en-US');b.api.cancel();b.start({lang:'ja-JP'});assert.equal(b.recognizers[2].lang,'ja-JP');
});
test('確定後onendが来ないブラウザでも一回だけ結果を返す',()=>{
 const b=setup();b.start();const r=b.recognizers[0];r.onresult({results:[b.result('How is it going')]});const t=[...b.timers.values()].find(t=>t.ms===350);t.fn();t.fn();assert.equal(b.outputs.length,1);
});
test('停止後にonendが来なくてもタイムアウトで途中結果を回収',()=>{
 const b=setup();b.start();b.recognizers[0].onresult({results:[b.result('How is it going',false)]});b.api.stop();[...b.timers.values()].find(t=>t.ms===1800).fn();assert.equal(b.outputs.length,1);assert.equal(b.api.isActive(),false);
});
test('無音・権限拒否・ネットワークエラーは復帰可能でGOOD用結果を返さない',()=>{
 for(const code of ['no-speech','not-allowed','network','audio-capture','service-not-allowed']){const b=setup();b.start();b.recognizers[0].onerror({error:code});assert.equal(b.last().phase,'error');assert.equal(b.outputs.length,0);assert.equal(b.api.isActive(),false);assert.equal(b.start(),true);}
});
test('初回の許可待ちに20秒制限を使わず、許可待ちの終了後も再試行可能',()=>{
 const b=setup();b.start();assert.ok([...b.timers.values()].some(t=>t.ms===45000));assert.ok(![...b.timers.values()].some(t=>t.ms===20000));[...b.timers.values()].find(t=>t.ms===45000).fn();assert.equal(b.last().phase,'error');assert.equal(b.start(),true);
});
test('非対応・HTTP・開始例外を捕捉し、処理を残さない',()=>{
 for(const options of [{unsupported:true},{insecure:true},{startThrows:true}]){const b=setup(options);assert.equal(b.start(),false);assert.equal(b.api.isActive(),false);assert.equal(b.last().phase,'error');}
});

test('発話終了を自動検出してstopし、確定結果まで待つ',()=>{
 const b=setup();b.start();const r=b.recognizers[0];r.onstart();r.onresult({results:[b.result('How is it going',false)]});r.onspeechend();assert.equal(r.stopped,true);assert.equal(b.outputs.length,0);r.onresult({results:[b.result('How is it going')]});r.onend();assert.deepEqual(b.outputs,['How is it going']);
});
test('speechendがない実装でも途中結果の更新後の無音待ちで自動停止',()=>{
 const b=setup();b.start();const r=b.recognizers[0];r.onresult({results:[b.result('How is it going',false)]});[...b.timers.values()].find(t=>t.ms===2000).fn();assert.equal(r.stopped,true);r.onend();assert.deepEqual(b.outputs,['How is it going']);
});
test('自動会話で音声認識が失敗したとき、停止用のonErrorを一度だけ呼ぶ',()=>{
 const b=setup();let count=0;b.start({onError:()=>count++});const r=b.recognizers[0],late=r.onerror;r.onerror({error:'not-allowed'});late({error:'network'});assert.equal(count,1);
});
