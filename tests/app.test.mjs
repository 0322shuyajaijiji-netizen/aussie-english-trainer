import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const data=JSON.parse(read('phrases.json'));
function boot({stored=null,storageFails=false,media=false,sr=false,hash='',getMedia}={}){
 const elements=new Map(), events={},timeouts=new Map(), revokes=[],spoken=[],tracks=[],recorders=[],recognizers=[],urls=[];let timer=0,blobId=0;
 class Element {
  constructor(id){this.id=id;this._html='';this.textContent='';this.value='';this.disabled=false;this.children=[];this.classList={add(){},remove(){},toggle(){}};}
  set innerHTML(v){this._html=v;for(const match of v.matchAll(/\bid="([^"]+)"/g)){const el=new Element(match[1]);elements.set(match[1],el);}}
  get innerHTML(){return this._html;}
  replaceChildren(...els){this.children=els;}
  setAttribute(k,v){this[k]=v;} focus(){} click(){} showModal(){this.open=true;} close(){this.open=false;}
 }
 for(const id of ['app','nav','main','toast','good-popup','good-note'])elements.set(id,new Element(id));
 class Recorder {
  constructor(s){this.stream=s;this.mimeType='audio/webm';this.state='inactive';recorders.push(this);}
  start(){this.state='recording';}stop(){this.state='inactive';this.ondataavailable?.({data:new Blob(['voice'],{type:'audio/webm'})});this.onstop?.();}
 }
 class Recognition {
  constructor(){recognizers.push(this);}start(){}abort(){this.aborted=true;}
 }
 const storage=new Map(stored?[['aussie-english-v1',JSON.stringify(stored)]]:[]);
 const ctx={console,Blob,Date,Set,Map,Array,Object,String,Number,JSON,Math,Error,RegExp,Promise,
 document:{getElementById:id=>elements.get(id)||null,createElement:tag=>new Element(tag),addEventListener:(t,fn)=>events[t]=fn,hidden:false},
 localStorage:{getItem:k=>{if(storageFails)throw Error('denied');return storage.get(k)||null;},setItem:(k,v)=>{if(storageFails)throw Error('denied');storage.set(k,v);}},
 location:{hash},history:{replaceState(a,b,v){ctx.location.hash=v;}},
 navigator:{mediaDevices:media?{getUserMedia:getMedia||(async()=>{const track={stopped:false,stop(){this.stopped=true;}};tracks.push(track);return {getTracks:()=>[track]};})}:undefined},
 isSecureContext:true,URL:{createObjectURL:b=>{urls.push(b);return `blob:test${++blobId}`;},revokeObjectURL:u=>revokes.push(u)},
 confirm:()=>true,setTimeout:(fn,ms)=>{timeouts.set(++timer,{fn,ms});return timer;},clearTimeout:id=>timeouts.delete(id),
 speechSynthesis:{cancel(){},getVoices:()=>[{name:'US voice',lang:'en-US'},{name:'Aussie',lang:'en-AU'}],speak:u=>spoken.push(u),addEventListener(){}},
 SpeechSynthesisUtterance:class{constructor(text){this.text=text;}},addEventListener:(t,fn)=>events[t]=fn,scrollTo(){}};
 if(media)ctx.MediaRecorder=Recorder;if(sr)ctx.SpeechRecognition=Recognition;ctx.window=ctx;
 vm.createContext(ctx);for(const f of ['phrases.js','core.js','scenarios.js','app.js'])vm.runInContext(read(f),ctx,{filename:f});
 const click=(action,props={})=>events.click({target:{closest:()=>({dataset:{action,...props},disabled:false})}});
 const flush=()=>new Promise(resolve=>setImmediate(resolve));
 const change=(id,value,checked)=>events.change({target:{id,value,checked}});
 const input=(id,value)=>{elements.get(id).value=value;events.input({target:{id,value}});};
 const saved=()=>JSON.parse(storage.get('aussie-english-v1')||'{}');
 return {ctx,elements,events,click,change,input,saved,spoken,tracks,recorders,recognizers,revokes,urls,timeouts,flush,html:()=>elements.get('app').innerHTML};
}
test('129教材と会話は原教材と完全一致。配信JSもJSONと一致',()=>{
 assert.equal(data.length,129);assert.equal(new Set(data.map(p=>p.id)).size,129);
 assert.deepEqual(data,JSON.parse(read('original/phrases.json')));
 const ctx={window:{}};vm.runInNewContext(read('phrases.js'),ctx);assert.equal(JSON.stringify(ctx.window.PHRASES),JSON.stringify(data));
 assert.equal(new Set(data.map(p=>p.category)).size,7);
});
test('単語照合は語順・繰り返し・追加・欠落を識別、アポストロフィを正規化',()=>{
 const {ctx}=boot(),C=ctx.AussieCore;
 assert.equal(C.compare('How’s it going?',"How's it going").score,100);
 assert.equal(C.compare('a b','b a').score,50);
 const r=C.compare('I like like tea','I like coffee');assert.equal(r.expected.filter(w=>w.match).length,2);assert.equal(r.actual.filter(w=>!w.match)[0].text,'coffee');
 assert.equal(C.compare('Hello','').score,0);
 assert.equal(C.compare('','').score,0);
 assert.ok(C.compare('<script>','<script>').expected.every(w=>!w.text.includes('<')));
});
test('旧版記録を引き継ぎ、不正なID・件数・型を保存対象から除外',()=>{
 const b=boot({stored:{done:{1:true,999:true,2:'true'},star:{2:true},attempts:{1:5,2:-5},quiz:{'1:en':{total:2,correct:999,misses:-1}}}});
 const cleaned=b.ctx.AussieCore.cleanState({done:{999:true},sessions:'99'},data);assert.equal(Object.keys(cleaned.done).length,0);assert.equal(cleaned.sessions,0);
 b.click('tab',{value:'learn'});assert.match(b.html(),/✓ 学習済み/);b.click('star');const s=b.saved();assert.equal(s.attempts[1],5);assert.equal(s.attempts[2],0);assert.equal(s.done[999],undefined);assert.equal(s.quiz['1:en'].correct,2);
});
test('検索・カテゴリー・苦手絞り込み・英日非表示は一覧にも反映',()=>{
 const b=boot();b.click('tab',{value:'learn'});b.input('search','ラテ');assert.match(b.elements.get('learn-content').innerHTML,/Can I get a latte/);
 b.input('search','<script>');assert.match(b.elements.get('learn-content').innerHTML,/見つかりませんでした/);
 b.click('clear-filter');b.change('category','カフェ');assert.match(b.html(),/No. 054/);b.click('star');b.change('only-star','',true);assert.match(b.html(),/1 フレーズ/);
 b.click('toggle-en');assert.doesNotMatch(b.html(),/Can I get a latte/);b.click('toggle-ja');assert.doesNotMatch(b.html(),/ラテを/);
});
test('双方向の暗記・二重回答防止・誤答優先復習・正答率・学習回数',()=>{
 const b=boot();b.click('tab',{value:'quiz'});b.click('quiz-reveal');b.click('quiz-wrong');b.click('quiz-wrong');let s=b.saved();assert.equal(s.quiz['1:en'].total,1);assert.equal(s.star[1],true);
 b.click('quiz-next');assert.match(b.html(),/No. 2/);b.click('quiz-reveal');b.click('quiz-correct');b.click('quiz-next');assert.match(b.html(),/前回の復習/);
 b.click('quiz-ja');assert.match(b.html(),/意味を日本語で話そう/);b.click('quiz-reveal');b.click('quiz-correct');s=b.saved();assert.equal(s.quiz['1:ja'].correct,1);assert.equal(s.sessions,1);
 b.click('tab',{value:'progress'});assert.match(b.html(),/2 \/ 3 問正解/);assert.match(b.html(),/>67<small>/);assert.match(b.html(),/>3<small> 回/);
});
test('localStorage拒否でも全学習画面が動作する',()=>{
 const b=boot({storageFails:true});for(const value of ['home','learn','speak','quiz','role','progress']){b.click('tab',{value});assert.ok(b.html().length>500);}b.click('tab',{value:'learn'});assert.doesNotThrow(()=>b.click('done'));assert.match(b.html(),/保存できません/);
});
test('音声はen-AU優先、無ければ他の英語。非対応でも照合可能',()=>{
 const b=boot();b.click('tab',{value:'speak'});b.click('speak-phrase');assert.equal(b.spoken.at(-1).voice.lang,'en-AU');
 b.ctx.speechSynthesis.getVoices=()=>[{name:'fallback',lang:'en-GB'}];b.click('speak-phrase');assert.equal(b.spoken.at(-1).voice.lang,'en-GB');
 b.elements.get('speech-input').value="How's it going?";b.click('compare');assert.match(b.elements.get('status').innerHTML,/100%/);assert.match(b.elements.get('status').innerHTML,/発音の点数ではありません/);
});
test('音声認識非対応でも録音・再生し、画面移動でトラック停止とURL解放',async()=>{
 const b=boot({media:true});b.click('tab',{value:'speak'});b.click('record');await new Promise(resolve=>setImmediate(resolve));assert.equal(b.recorders.length,1);b.click('record');assert.equal(b.recorders.length,1);b.click('record-stop');assert.ok(b.tracks[0].stopped);assert.equal(b.elements.get('playback').children[0].controls,true);
 b.click('tab',{value:'home'});assert.equal(b.revokes.length,1);
});
test('マイク権限要求中に画面を離れた場合、許可後のトラックも確実に停止',async()=>{
 let resolve;const pending=new Promise(r=>resolve=r),track={stopped:false,stop(){this.stopped=true;}};
 const b=boot({media:true,getMedia:()=>pending});b.click('tab',{value:'speak'});b.click('record');b.click('tab',{value:'home'});resolve({getTracks:()=>[track]});await new Promise(resolve=>setImmediate(resolve));assert.equal(track.stopped,true);assert.equal(b.recorders.length,0);
});
test('マイク拒否は日本語で表示し、再試行できる',async()=>{
 const b=boot({media:true,getMedia:async()=>{const e=new Error();e.name='NotAllowedError';throw e;}});b.click('tab',{value:'speak'});b.click('record');await new Promise(resolve=>setImmediate(resolve));assert.match(b.elements.get('record-status').textContent,/許可されません/);assert.equal(b.elements.get('record-start').disabled,false);
});
test('録音中の画面遷移・非表示はマイクを解放する',async()=>{
 const b=boot({media:true});b.click('tab',{value:'speak'});b.click('record');await new Promise(resolve=>setImmediate(resolve));b.click('next');assert.equal(b.tracks[0].stopped,true);assert.equal(b.recorders[0].state,'inactive');
 b.click('record');await new Promise(resolve=>setImmediate(resolve));b.ctx.document.hidden=true;b.events.visibilitychange();assert.equal(b.tracks[1].stopped,true);
});
test('音声認識の成功・ネットワーク失敗・遷移後の遅延コールバック',()=>{
 const b=boot({sr:true});b.click('tab',{value:'speak'});b.click('recognize');const r=b.recognizers[0],result=r.onresult;r.onresult({results:[[{transcript:"How's it going?"}]]});assert.match(b.elements.get('status').innerHTML,/100%/);
 b.click('recognize');b.recognizers[1].onerror({error:'network'});assert.match(b.elements.get('status').textContent,/ネットワーク/);
 b.click('recognize');const late=b.recognizers[2].onresult;b.click('tab',{value:'home'});assert.doesNotThrow(()=>late({results:[[{transcript:'late'}]]}));assert.match(b.html(),/Australia/);
});
test('教材ロールプレイはA/B両役で完了できる',()=>{
 const b=boot();b.click('tab',{value:'role'});b.change('my-role','A');for(let i=0;i<data[0].dialogue.length;i++)b.click('role-next');assert.match(b.html(),/会話完了/);assert.equal(b.saved().attempts[1],1);
});
test('4場面の分岐は全ノード到達可能、全選択先が存在、終了に到達',()=>{
 const {ctx}=boot();assert.equal(ctx.BRANCHES.length,4);
 for(const b of ctx.BRANCHES){const visited=new Set(),walk=id=>{if(visited.has(id))return;visited.add(id);const node=b.nodes[id];assert.ok(node);for(const o of node.options){assert.ok(b.nodes[o.next]);walk(o.next);}};walk(b.start);assert.equal(visited.size,Object.keys(b.nodes).length);assert.ok([...visited].some(id=>b.nodes[id].options.length===0));}
});
test('分岐練習の会話完了は重複カウントしない',()=>{
 const b=boot();b.click('tab',{value:'role'});b.click('role-branch');b.click('branch-hear');b.click('branch-choice',{index:'0'});b.click('branch-hear');b.click('branch-choice',{index:'0'});b.click('branch-hear');b.click('branch-hear');assert.match(b.html(),/会話完了/);assert.equal(Object.values(b.saved().days)[0],1);
});
test('解答・検索・会話・バックアップ由来の文字列はHTMLエスケープ',()=>{
 const b=boot({sr:true});b.click('tab',{value:'quiz'});b.click('quiz-recognize');b.recognizers[0].onresult({results:[[{transcript:'<img src=x onerror=alert(1)>'}]]});assert.doesNotMatch(b.html(),/<img src=x/);assert.match(b.html(),/&lt;img/);
});
test('静的参照は全て相対パス・存在し、外部APIや有料依存がない',()=>{
 const html=read('index.html');for(const m of html.matchAll(/(?:src|href)="([^"#]+)"/g))assert.ok(fs.existsSync(path.join(root,m[1])),m[1]);
 for(const f of ['index.html','app.js','core.js','scenarios.js','styles.css'])assert.doesNotMatch(read(f).replace(/xmlns="[^"]*"/g,''),/https?:\/\/|fetch\(|XMLHttpRequest|api[_-]?key/i);
 assert.match(read('styles.css'),/@media\(max-width:700px\)/);assert.match(html,/<html lang="ja">/);
});

test('バックアップ復元は確認後に置換し、不正・巨大ファイルを拒否',async()=>{
 const b=boot();b.click('tab',{value:'progress'});
 const load=async text=>{b.events.change({target:{id:'import-file',files:[{size:text.length,text:async()=>text}]}});await b.flush();};
 await load(JSON.stringify({done:{5:true,999:true},star:{6:true},attempts:{5:3}}));assert.equal(b.saved().done[5],true);assert.equal(b.saved().done[999],undefined);
 const before=JSON.stringify(b.saved());await load('not json');assert.equal(JSON.stringify(b.saved()),before);
 await load(JSON.stringify({done:[],star:{}}));assert.equal(JSON.stringify(b.saved()),before);
 b.ctx.confirm=()=>false;await load(JSON.stringify({done:{1:true},star:{}}));assert.equal(JSON.stringify(b.saved()),before);
 b.events.change({target:{id:'import-file',files:[{size:3*1024*1024,text:async()=>''}]}});await b.flush();assert.match(b.elements.get('toast').textContent,/大きすぎます/);
});
test('録音自動停止と認識タイムアウトが終了UIを更新',async()=>{
 const b=boot({media:true,sr:true});b.click('tab',{value:'speak'});b.click('record');await b.flush();[...b.timeouts.values()].find(t=>t.ms===60000).fn();assert.equal(b.tracks[0].stopped,true);assert.equal(b.elements.get('playback').children.length,1);
 b.click('recognize');[...b.timeouts.values()].find(t=>t.ms===20000).fn();assert.equal(b.recognizers[0].aborted,true);assert.match(b.elements.get('status').textContent,/停止しました/);
});
test('録音デバイスが自発停止しても再生でき、開始ボタンを復帰',async()=>{
 const b=boot({media:true});b.click('tab',{value:'speak'});b.click('record');await b.flush();b.recorders[0].stop();assert.equal(b.tracks[0].stopped,true);assert.equal(b.elements.get('playback').children.length,1);assert.equal(b.elements.get('record-start').disabled,false);
});
test('全129会話は空でなく、選択可能なA/B役がある',()=>{
 for(const p of data){assert.ok(p.dialogue.length>=2);assert.ok(p.dialogue.some(d=>d.role==='A'));assert.ok(p.dialogue.some(d=>d.role==='B'));for(const d of p.dialogue)assert.ok(typeof d.text==='string'&&d.text.length>0);}
});

test('両学習画面からゆっくり聞くを削除、クイズに入力欄がない',()=>{
 const b=boot();for(const value of ['learn','speak']){b.click('tab',{value});assert.doesNotMatch(b.html(),/ゆっくり聞く|speak-slow/);}
 b.click('tab',{value:'quiz'});assert.doesNotMatch(b.html(),/<textarea|quiz-input/);assert.match(b.html(),/話して答える/);
});
test('英語の音声回答が一致するとGOODポップアップ、正解を一度だけ記録',()=>{
 const b=boot({sr:true});b.click('tab',{value:'quiz'});b.click('quiz-recognize');const r=b.recognizers[0];assert.equal(r.lang,'en-AU');
 const callback=r.onresult;callback({results:[[{transcript:'How is it going?'}]]});
 assert.equal(b.saved().quiz['1:en'].correct,1);assert.equal(b.elements.get('good-popup').open,true);assert.match(b.elements.get('good-note').textContent,/一致/);
 callback({results:[[{transcript:'How is it going?'}]]});b.click('quiz-correct');assert.equal(b.saved().quiz['1:en'].total,1);
 b.click('good-close');assert.equal(b.elements.get('good-popup').open,false);
});
test('認識が違う場合は即誤答にせず再挑戦・自己確認、GOODは出さない',()=>{
 const b=boot({sr:true});b.click('tab',{value:'quiz'});b.click('quiz-recognize');b.recognizers[0].onresult({results:[[{transcript:'Sorry'}]]});
 assert.notEqual(b.elements.get('good-popup').open,true);assert.equal(b.saved().quiz?.['1:en'],undefined);assert.match(b.html(),/もう一度話す/);
 b.click('quiz-wrong');assert.equal(b.saved().quiz['1:en'].misses,1);assert.equal(b.saved().star[1],true);
});
test('日本語の意味はja-JPで認識、一致時のGOOD、言い換えは自己確認',()=>{
 const b=boot({sr:true});b.click('tab',{value:'quiz'});b.click('quiz-ja');b.click('quiz-recognize');assert.equal(b.recognizers[0].lang,'ja-JP');
 b.recognizers[0].onresult({results:[[{transcript:'調子はどう'}]]});assert.equal(b.saved().quiz['1:ja'].correct,1);assert.equal(b.elements.get('good-popup').open,true);
 b.click('good-close');b.click('quiz-next');b.click('quiz-recognize');b.recognizers[1].onresult({results:[[{transcript:'元気です。あなたは'}]]});assert.match(b.html(),/自分でも確認/);assert.equal(b.saved().quiz['2:ja'],undefined);
});
test('音声非対応時も声に出して自己確認でき、GOODを表示',()=>{
 const b=boot();b.click('tab',{value:'quiz'});assert.match(b.html(),/認識に非対応/);b.click('quiz-reveal');b.click('quiz-correct');assert.equal(b.saved().quiz['1:en'].correct,1);assert.equal(b.elements.get('good-popup').open,true);assert.match(b.elements.get('good-note').textContent,/声に出して/);
});
test('全文表示ロールプレイは開始前から両役の全セリフが見える',()=>{
 const b=boot();b.click('tab',{value:'role'});for(const d of data[0].dialogue)assert.ok(b.html().includes(d.text.replaceAll('’','’')),d.text);assert.match(b.html(),/aria-current="step"/);assert.match(b.html(),/会話の全文/);assert.doesNotMatch(b.html(),/セリフのヒント/);
 b.click('role-line-audio',{index:'2'});assert.equal(b.spoken.at(-1).text,data[0].dialogue[2].text);
 b.click('role-next');assert.match(b.html(),/completed-turn/);assert.match(b.html(),/あなたの番/);
});
test('クイズの方向変更・次問・画面移動で古い認識結果を破棄',()=>{
 const b=boot({sr:true});b.click('tab',{value:'quiz'});b.click('quiz-recognize');const old=b.recognizers[0].onresult;b.click('quiz-ja');old({results:[[{transcript:'How is it going?'}]]});assert.equal(b.saved().quiz?.['1:en'],undefined);assert.match(b.html(),/意味を日本語/);
});
test('短縮形・スラッシュ・括弧の正当な選択表現で一致、語順や異なる単語は区別',()=>{
 const {ctx}=boot(),C=ctx.AussieCore;
 assert.equal(C.spokenCheck('Do you? / Did you? / Are you?','Did you').score,100);
 assert.equal(C.spokenCheck('Could I get an aisle (window) seat?','Could I get an window seat?').score,100);
 assert.equal(C.spokenCheck('How’s it going?','How is it going').score,100);
 assert.ok(C.spokenCheck('How’s it going?','Where am I').score<85);
 assert.equal(C.spokenCheck('調子はどう？','調子はどう','ja').score,100);
 assert.equal(C.spokenCheck('調子はどう？','','ja').score,0);
});
