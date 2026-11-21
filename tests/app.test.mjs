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
 for(const id of ['app','nav','main','toast','result-feedback','result-symbol','result-label'])elements.set(id,new Element(id));elements.get('result-feedback').hidden=true;
 class Recognition {
  constructor(){recognizers.push(this);}start(){this.onstart?.();}stop(){this.stopped=true;}abort(){this.aborted=true;}deliver(e){this.onresult?.(e);this.onend?.();}
 }
 const storage=new Map(stored?[['aussie-english-v1',JSON.stringify(stored)]]:[]);
 const ctx={console,Blob,Date,Set,Map,Array,Object,String,Number,JSON,Math,Error,RegExp,Promise,
 document:{getElementById:id=>elements.get(id)||null,createElement:tag=>new Element(tag),addEventListener:(t,fn)=>events[t]=fn,hidden:false},
 localStorage:{getItem:k=>{if(storageFails)throw Error('denied');return storage.get(k)||null;},setItem:(k,v)=>{if(storageFails)throw Error('denied');storage.set(k,v);}},
 location:{hash},history:{replaceState(a,b,v){ctx.location.hash=v;}},
 navigator:{mediaDevices:media?{getUserMedia:getMedia||(async()=>{const track={stopped:false,stop(){this.stopped=true;}};tracks.push(track);return {getTracks:()=>[track]};})}:undefined},
 isSecureContext:true,URL:{createObjectURL:b=>{urls.push(b);return `blob:test${++blobId}`;},revokeObjectURL:u=>revokes.push(u)},
 confirm:()=>true,setTimeout:(fn,ms)=>{const id=++timer;timeouts.set(id,{fn:()=>{timeouts.delete(id);fn();},ms});return id;},clearTimeout:id=>timeouts.delete(id),
 speechSynthesis:{cancel(){},getVoices:()=>[{name:'US voice',lang:'en-US'},{name:'Aussie',lang:'en-AU'}],speak:u=>spoken.push(u),addEventListener(){}},
 SpeechSynthesisUtterance:class{constructor(text){this.text=text;}},addEventListener:(t,fn)=>events[t]=fn,scrollTo(){}};
 if(sr)ctx.SpeechRecognition=Recognition;ctx.window=ctx;
 vm.createContext(ctx);for(const f of ['phrases.js','translations.js','core.js','speech.js','feedback.js','conversation.js','scenarios.js','app.js'])vm.runInContext(read(f),ctx,{filename:f});
 const click=(action,props={})=>events.click({target:{closest:()=>({dataset:{action,...props},disabled:false})}});
 const finishPartner=()=>{spoken.at(-1)?.onend?.();[...timeouts.values()].find(t=>t.ms===300)?.fn();};
 const advanceFeedback=()=>{[...timeouts.values()].find(t=>t.ms===1100)?.fn();};
 const flush=()=>new Promise(resolve=>setImmediate(resolve));
 const change=(id,value,checked)=>events.change({target:{id,value,checked}});
 const input=(id,value)=>{elements.get(id).value=value;events.input({target:{id,value}});};
 const saved=()=>JSON.parse(storage.get('aussie-english-v1')||'{}');
 return {ctx,elements,events,click,advanceFeedback,finishPartner,change,input,saved,spoken,tracks,recorders,recognizers,revokes,urls,timeouts,flush,html:()=>elements.get('app').innerHTML};
}
test('原教材129件を保持し、追加64件を含む193件のJSONと配信JSが一致',()=>{
 assert.equal(data.length,193);assert.equal(new Set(data.map(p=>p.id)).size,193);
 assert.deepEqual(data.slice(0,129),JSON.parse(read('original/phrases.json')));
 const ctx={window:{}};vm.runInNewContext(read('phrases.js'),ctx);assert.equal(JSON.stringify(ctx.window.PHRASES),JSON.stringify(data));
 assert.equal(new Set(data.map(p=>p.category)).size,12);
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
 b.click('tab',{value:'learn'});b.click('situation-select',{value:'すべて'});assert.match(b.html(),/✓ 学習済み/);b.click('star');const s=b.saved();assert.equal(s.attempts[1],5);assert.equal(s.attempts[2],0);assert.equal(s.done[999],undefined);assert.equal(s.quiz['1:en'].correct,2);
});
test('場面選択後に検索・カテゴリー欄はなく、苦手絞り込み・英日非表示は残る',()=>{
 const b=boot();b.click('tab',{value:'learn'});b.click('situation-select',{value:'カフェ'});
 assert.doesNotMatch(b.html(),/id="search"|id="category"/);assert.match(b.html(),/No. 054/);
 b.click('star');b.change('only-star','',true);assert.match(b.html(),/1 フレーズ/);
 b.click('toggle-en');assert.doesNotMatch(b.html(),/Can I get a latte/);b.click('toggle-ja');assert.doesNotMatch(b.html(),/ラテを/);
});
test('日本語から英語の暗記・二重回答防止・誤答優先復習・正答率・学習回数',()=>{
 const b=boot();b.click('tab',{value:'quiz'});b.click('situation-select',{value:'すべて'});b.click('quiz-reveal');b.click('quiz-wrong');b.click('quiz-wrong');let s=b.saved();assert.equal(s.quiz['1:en'].total,1);assert.equal(s.star[1],true);
 b.click('quiz-next');assert.match(b.html(),/No. 2/);b.click('quiz-reveal');b.click('quiz-correct');b.click('quiz-next');assert.match(b.html(),/前回の復習/);
 b.click('quiz-reveal');b.click('quiz-correct');s=b.saved();assert.equal(s.quiz['1:en'].correct,1);assert.equal(s.sessions,1);
 b.click('tab',{value:'progress'});assert.match(b.html(),/2 \/ 3 問正解/);assert.match(b.html(),/>67<small>/);assert.match(b.html(),/>3<small> 回/);
});
test('localStorage拒否でも全学習画面が動作する',()=>{
 const b=boot({storageFails:true});for(const value of ['home','learn','speak','quiz','role','progress']){b.click('tab',{value});assert.ok(b.html().length>500);}b.click('tab',{value:'learn'});b.click('situation-select',{value:'すべて'});assert.doesNotThrow(()=>b.click('done'));assert.match(b.html(),/保存できません/);
});
test('音声はen-AU優先、無ければ他の英語。非対応でも照合可能',()=>{
 const b=boot();b.click('tab',{value:'speak'});b.click('situation-select',{value:'すべて'});b.click('speak-phrase');assert.equal(b.spoken.at(-1).voice.lang,'en-AU');
 b.ctx.speechSynthesis.getVoices=()=>[{name:'fallback',lang:'en-GB'}];b.click('speak-phrase');assert.equal(b.spoken.at(-1).voice.lang,'en-GB');
 b.elements.get('speech-input').value="How's it going?";b.click('compare');assert.match(b.elements.get('status').innerHTML,/100%/);assert.match(b.elements.get('status').innerHTML,/発音の点数ではありません/);
});




test('音声認識の成功・ネットワーク失敗・遷移後の遅延コールバック',()=>{
 const b=boot({sr:true});b.click('tab',{value:'speak'});b.click('situation-select',{value:'すべて'});b.click('recognize');const r=b.recognizers[0],result=r.onresult;r.deliver({results:[[{transcript:"How's it going?"}]]});assert.match(b.elements.get('status').innerHTML,/100%/);
 b.click('recognize');b.recognizers[1].onerror({error:'network'});assert.match(b.elements.get('speech-state').textContent,/接続できません/);
 b.click('recognize');const late=b.recognizers[2].onresult;b.click('tab',{value:'home'});assert.doesNotThrow(()=>late({results:[[{transcript:'late'}]]}));assert.match(b.html(),/Australia/);
});
test('教材ロールプレイはA/B両役で一度のスタートから最後まで自動進行',()=>{
 for(const role of ['A','B']){
  const b=boot({sr:true});b.click('tab',{value:'role'});b.click('situation-select',{value:'すべて'});b.change('my-role',role);b.click('conversation-start');
  for(const line of data[0].dialogue){if(line.role===role){b.recognizers.at(-1).deliver({results:[[{transcript:line.text}]]});b.advanceFeedback();}else b.finishPartner();}
  assert.match(b.html(),/Good on ya!/);assert.equal(b.elements.get('result-label').textContent,'Good on ya!');assert.equal(b.saved().attempts[1],1);
 }
});
test('9場面の分岐は全ノード到達可能、全選択先が存在、終了に到達',()=>{
 const {ctx}=boot();assert.equal(ctx.BRANCHES.length,9);
 for(const b of ctx.BRANCHES){const visited=new Set(),walk=id=>{if(visited.has(id))return;visited.add(id);const node=b.nodes[id];assert.ok(node);for(const o of node.options){assert.ok(b.nodes[o.next]);walk(o.next);}};walk(b.start);assert.equal(visited.size,Object.keys(b.nodes).length);assert.ok([...visited].some(id=>b.nodes[id].options.length===0));}
});
test('分岐練習も一度のスタートで自動進行し、会話完了は重複カウントしない',()=>{
 const b=boot({sr:true});b.click('tab',{value:'role'});b.click('situation-select',{value:'カフェ'});b.click('role-branch');b.click('conversation-start');b.finishPartner();
 b.recognizers.at(-1).deliver({results:[[{transcript:'Can I get a latte'}]]});b.advanceFeedback();b.finishPartner();b.recognizers.at(-1).deliver({results:[[{transcript:'I’m having it here.'}]]});b.advanceFeedback();b.finishPartner();b.finishPartner();assert.match(b.html(),/Good on ya!/);assert.equal(Object.values(b.saved().days)[0],1);
});
test('解答・検索・会話・バックアップ由来の文字列はHTMLエスケープ',()=>{
 const b=boot({sr:true});b.click('tab',{value:'quiz'});b.click('situation-select',{value:'すべて'});b.click('quiz-recognize');b.recognizers[0].deliver({results:[[{transcript:'<img src=x onerror=alert(1)>'}]]});assert.doesNotMatch(b.html(),/<img src=x/);assert.match(b.html(),/&lt;img/);
});
test('静的参照は全て相対パス・存在し、外部APIや有料依存がない',()=>{
 const html=read('index.html');for(const m of html.matchAll(/(?:src|href)="([^"#]+)"/g))assert.ok(fs.existsSync(path.join(root,m[1])),m[1]);
 for(const f of ['index.html','app.js','core.js','speech.js','scenarios.js','styles.css'])assert.doesNotMatch(read(f).replace(/xmlns="[^"]*"/g,''),/https?:\/\/|fetch\(|XMLHttpRequest|api[_-]?key/i);
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


test('全193会話は空でなく、選択可能なA/B役がある',()=>{
 for(const p of data){assert.ok(p.dialogue.length>=2);assert.ok(p.dialogue.some(d=>d.role==='A'));assert.ok(p.dialogue.some(d=>d.role==='B'));for(const d of p.dialogue)assert.ok(typeof d.text==='string'&&d.text.length>0);}
});

test('両学習画面からゆっくり聞くを削除、クイズに入力欄がない',()=>{
 const b=boot();for(const value of ['learn','speak']){b.click('tab',{value});assert.doesNotMatch(b.html(),/ゆっくり聞く|speak-slow/);}
 b.click('tab',{value:'quiz'});b.click('situation-select',{value:'すべて'});assert.doesNotMatch(b.html(),/<textarea|quiz-input/);assert.match(b.html(),/話して答える/);
});
test('英語の音声回答が一致すると○表示、正解を一度だけ記録',()=>{
 const b=boot({sr:true});b.click('tab',{value:'quiz'});b.click('situation-select',{value:'すべて'});b.click('quiz-recognize');const r=b.recognizers[0];assert.equal(r.lang,'en-AU');
 const callback=r.onresult;callback({results:[[{transcript:'How is it going?'}]]});r.onend?.();
 assert.equal(b.saved().quiz['1:en'].correct,1);assert.equal(b.elements.get('result-feedback').hidden,false);assert.equal(b.elements.get('result-symbol').textContent,'○');assert.match(b.elements.get('result-label').textContent,/1回クリア/);
 callback({results:[[{transcript:'How is it going?'}]]});b.click('quiz-correct');assert.equal(b.saved().quiz['1:en'].total,1);
 b.advanceFeedback();assert.equal(b.elements.get('result-feedback').hidden,true);
});
test('認識が違う場合は即誤答にせず再挑戦・自己確認、×を表示',()=>{
 const b=boot({sr:true});b.click('tab',{value:'quiz'});b.click('situation-select',{value:'すべて'});b.click('quiz-recognize');b.recognizers[0].deliver({results:[[{transcript:'Sorry'}]]});
 assert.notEqual(b.elements.get('result-symbol').textContent,'○');assert.equal(b.saved().quiz?.['1:en'],undefined);assert.match(b.html(),/もう一度話す/);
 b.click('quiz-wrong');assert.equal(b.saved().quiz['1:en'].misses,1);assert.equal(b.saved().star[1],true);
});
test('暗記チェックは日本語を見て英語で回答する形式だけで、旧操作では切り替わらない',()=>{
 const b=boot({sr:true});b.click('tab',{value:'quiz'});b.click('situation-select',{value:'すべて'});assert.doesNotMatch(b.html(),/quiz-ja|quiz-en|英語 → 意味|意味を日本語/);assert.match(b.html(),/調子はどう/);b.click('quiz-ja');b.click('quiz-recognize');assert.equal(b.recognizers[0].lang,'en-AU');b.recognizers[0].deliver({results:[[{transcript:'How is it going'}]]});assert.equal(b.saved().quiz['1:en'].correct,1);assert.equal(b.saved().quiz['1:ja'],undefined);
});
test('音声非対応時は自己確認を記録し、○による音声一致とは区別',()=>{
 const b=boot();b.click('tab',{value:'quiz'});b.click('situation-select',{value:'すべて'});assert.match(b.html(),/認識に非対応/);b.click('quiz-reveal');b.click('quiz-correct');assert.equal(b.saved().quiz['1:en'].correct,1);assert.notEqual(b.elements.get('result-symbol').textContent,'○');
});
test('全文表示ロールプレイは開始前から両役の全セリフが見える',()=>{
 const b=boot({sr:true});b.click('tab',{value:'role'});b.click('situation-select',{value:'すべて'});for(const d of data[0].dialogue)assert.ok(b.html().includes(d.text.replaceAll('’','’')),d.text);assert.match(b.html(),/aria-current="step"/);assert.match(b.html(),/会話の全文/);assert.doesNotMatch(b.html(),/セリフのヒント/);
 b.click('role-line-audio',{index:'2'});assert.equal(b.spoken.at(-1).text,data[0].dialogue[2].text);
 b.click('conversation-start');b.finishPartner();assert.match(b.html(),/completed-turn/);assert.match(b.html(),/あなたの番/);
});
test('クイズの場面変更・次問・画面移動で古い認識結果を破棄',()=>{
 const b=boot({sr:true});b.click('tab',{value:'quiz'});b.click('situation-select',{value:'すべて'});b.click('quiz-recognize');const old=b.recognizers[0].onresult;b.click('situations-back');b.click('situation-select',{value:'カフェ'});old({results:[[{transcript:'How is it going?'}]]});assert.equal(b.saved().quiz?.['1:en'],undefined);assert.match(b.html(),/No. 54/);
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

test('学習メニューは一箇所、ホームに重複した遷移ボタンを置かない',()=>{
 const b=boot();assert.equal((b.elements.get('nav').innerHTML.match(/data-action="tab"/g)||[]).length,5);assert.doesNotMatch(b.html(),/data-action="tab"|start-learn|mode-grid/);
 for(const value of ['learn','speak','quiz','role']){b.click('tab',{value});assert.doesNotMatch(b.html(),/録音|聞き直|record-stop|playback/);}
 assert.doesNotMatch(read('app.js')+read('speech.js'),/MediaRecorder|getUserMedia|recordingUrl/);
});
test('発音練習で全体が一致したときGOOD、欠落があれば表示しない',()=>{
 const b=boot({sr:true});b.click('tab',{value:'speak'});b.click('situation-select',{value:'すべて'});b.click('recognize');b.recognizers[0].deliver({results:[[{transcript:'How is it going'}]]});assert.equal(b.elements.get('result-feedback').hidden,false);assert.equal(b.elements.get('result-symbol').textContent,'○');
 b.advanceFeedback();b.click('recognize');b.recognizers[1].deliver({results:[[{transcript:'How is going'}]]});assert.equal(b.elements.get('result-symbol').textContent,'×');
});
test('教材会話は不一致なら自動再挑戦、一致なら○のあと相手の音声へ',()=>{
 const b=boot({sr:true});b.click('tab',{value:'role'});b.click('situation-select',{value:'すべて'});b.change('my-role','A');b.click('conversation-start');assert.equal(b.recognizers.length,1);assert.equal(b.spoken.length,0);
 b.recognizers[0].deliver({results:[[{transcript:'Sorry'}]]});assert.equal(b.elements.get('result-symbol').textContent,'×');b.advanceFeedback();assert.equal(b.recognizers.length,2);assert.match(b.html(),/1 \/ 4/);
 b.recognizers[1].deliver({results:[[{transcript:data[0].dialogue[0].text}]]});assert.equal(b.elements.get('result-symbol').textContent,'○');b.advanceFeedback();assert.match(b.html(),/2 \/ 4/);assert.equal(b.spoken.at(-1).text,data[0].dialogue[1].text);
});
test('分岐会話は相手役の音声完了後に自動で認識し、正解後の分岐音声を再生',()=>{
 const b=boot({sr:true});b.click('tab',{value:'role'});b.click('situation-select',{value:'カフェ'});b.click('role-branch');b.click('conversation-start');assert.equal(b.recognizers.length,0);b.finishPartner();assert.equal(b.recognizers.length,1);b.recognizers[0].deliver({results:[[{transcript:'Can I get a latte'}]]});b.advanceFeedback();assert.equal(b.spoken.at(-1).text,'Having here, or take away?');
});
test('発話終了イベントでstopし、遅い確定結果を自動判定',()=>{
 const b=boot({sr:true});b.click('tab',{value:'speak'});b.click('situation-select',{value:'すべて'});b.click('recognize');const r=b.recognizers[0];const interim=[{transcript:'How is it'}];interim.isFinal=false;r.onresult({results:[interim]});assert.equal(b.elements.get('speech-transcript').textContent,'How is it');r.onspeechend();assert.equal(r.stopped,true);assert.notEqual(r.aborted,true);r.deliver({results:[[{transcript:'How is it going'}]]});assert.equal(b.elements.get('result-feedback').hidden,false);assert.equal(b.elements.get('result-symbol').textContent,'○');
});

test('フレーズは最初に12シチュエーションを表示し、選択後だけフレーズを表示',()=>{
 const b=boot();b.click('tab',{value:'learn'});assert.match(b.html(),/どこで話す/);assert.match(b.html(),/situation-grid/);assert.doesNotMatch(b.html(),/No. 001|learn-content/);
 b.click('situation-select',{value:'カフェ'});assert.match(b.html(),/No. 054/);assert.match(b.html(),/24 フレーズ/);assert.doesNotMatch(b.html(),/situation-grid/);
 b.click('situations-back');assert.match(b.html(),/situation-grid/);
});
test('音声一致は○、不一致は×。ボタンなしで表示が消え、正解は次へ進む',()=>{
 const b=boot({sr:true});b.click('tab',{value:'speak'});b.click('situation-select',{value:'すべて'});b.click('recognize');b.recognizers[0].deliver({results:[[{transcript:'How is it going'}]]});assert.equal(b.elements.get('result-symbol').textContent,'○');assert.doesNotMatch(read('index.html'),/<dialog|good-close|つづける/);b.advanceFeedback();assert.equal(b.elements.get('result-feedback').hidden,true);assert.match(b.html(),/Good, yourself/);
 b.click('recognize');b.recognizers[1].deliver({results:[[{transcript:'Sorry'}]]});assert.equal(b.elements.get('result-symbol').textContent,'×');b.advanceFeedback();assert.match(b.html(),/Good, yourself/);
});
test('正解表示中に別の画面へ移動しても古い自動遷移を実行しない',()=>{
 const b=boot({sr:true});b.click('tab',{value:'quiz'});b.click('situation-select',{value:'すべて'});b.click('quiz-recognize');b.recognizers[0].deliver({results:[[{transcript:'How is it going'}]]});const timer=[...b.timeouts.values()].find(t=>t.ms===1100);b.click('tab',{value:'home'});timer.fn();assert.match(b.html(),/Australia/);assert.equal(b.elements.get('result-feedback').hidden,true);
});
test('音声入力画面に手動終了ボタンを出さない',()=>{
 const b=boot({sr:true});for(const value of ['speak','quiz','role']){b.click('tab',{value});assert.doesNotMatch(b.html(),/recognize-stop|recognition-stop|話し終わった/);}
});
test('暗記は正解後自動で次問へ、会話は一時停止で古い自動遷移を止める',()=>{
 const q=boot({sr:true});q.click('tab',{value:'quiz'});q.click('situation-select',{value:'すべて'});q.click('quiz-recognize');q.recognizers[0].deliver({results:[[{transcript:'How is it going'}]]});q.advanceFeedback();assert.match(q.html(),/No. 2/);
 const b=boot({sr:true});b.click('tab',{value:'role'});b.click('situation-select',{value:'すべて'});b.change('my-role','A');b.click('conversation-start');b.recognizers[0].deliver({results:[[{transcript:data[0].dialogue[0].text}]]});const old=[...b.timeouts.values()].find(t=>t.ms===1100);b.click('conversation-pause');old.fn();assert.match(b.html(),/1 \/ 4/);assert.match(b.html(),/再開/);
});
test('全4学習モードは最初にシチュエーションを選び、選び直せる',()=>{
 const b=boot();for(const value of ['learn','speak','quiz','role']){
  b.click('tab',{value});assert.match(b.html(),/situation-grid/);assert.doesNotMatch(b.html(),/id="recognize-start"|id="role-id"|id="quiz-input"/);
  b.click('situation-select',{value:'カフェ'});assert.doesNotMatch(b.html(),/situation-grid/);assert.match(b.html(),/カフェ/);
  b.click('situations-back');assert.match(b.html(),/situation-grid/);
 }
});
test('発音練習の前後移動と正解後の自動移動は選択シーンの範囲で循環',()=>{
 const b=boot({sr:true});b.click('tab',{value:'speak'});b.click('situation-select',{value:'カフェ'});assert.match(b.html(),/Can I get a latte/);assert.match(b.html(),/1 \/ 24/);
 b.click('prev');assert.match(b.html(),/How long is the wait for food/);assert.match(b.html(),/24 \/ 24/);b.click('recognize');b.recognizers[0].deliver({results:[[{transcript:data.filter(p=>p.category==='カフェ').at(-1).en}]]});b.advanceFeedback();assert.match(b.html(),/Can I get a latte/);assert.match(b.html(),/1 \/ 24/);
});
test('暗記の誤答優先・次問も選択シーン外を出題しない',()=>{
 const b=boot({stored:{done:{},star:{1:true},quiz:{'1:en':{total:5,correct:0,misses:5,lastWrong:true},'55:en':{total:1,correct:0,misses:1,lastWrong:true}}}});
 b.click('tab',{value:'quiz'});b.click('situation-select',{value:'カフェ'});assert.match(b.html(),/No. 55/);
 for(let i=0;i<20;i++){const id=Number(b.html().match(/No\. (\d+)/)[1]);assert.ok(data.filter(p=>p.category==='カフェ').some(p=>p.id===id));b.click('quiz-reveal');b.click('quiz-correct');b.click('quiz-next');}
 const id=Number(b.html().match(/No\. (\d+)/)[1]);assert.ok(data.filter(p=>p.category==='カフェ').some(p=>p.id===id));
});
test('会話は選んだ場面の教材を表示し、Extra Practiceも対応する場面だけ表示',()=>{
 const b=boot();b.click('tab',{value:'role'});b.click('situation-select',{value:'カフェ'});assert.match(b.html(),/data-phrase-id="54"/);assert.doesNotMatch(b.html(),/id="role-id"|id="role-category"/);
 b.click('role-branch');assert.match(b.html(),/カフェで注文/);assert.doesNotMatch(b.html(),/空港でチェックイン|id="branch-id"/);
 b.click('situations-back');b.click('situation-select',{value:'空港・機内'});b.click('role-branch');assert.match(b.html(),/空港でチェックイン/);assert.doesNotMatch(b.html(),/カフェで注文/);
 b.click('situations-back');b.click('situation-select',{value:'リアクション・フィラー'});assert.doesNotMatch(b.html(),/data-action="role-branch"/);assert.match(b.html(),/data-phrase-id="22"/);
});
test('12シチュエーションは発音・暗記・会話のどのモードでも対象教材に一致',()=>{
 const b=boot();for(const value of ['speak','quiz','role'])for(const cat of [...new Set(data.map(p=>p.category))]){
  b.click('tab',{value});b.click('situations-back');b.click('situation-select',{value:cat});const first=data.find(p=>p.category===cat);assert.match(b.html(),new RegExp(cat));
  if(value==='quiz')assert.ok(b.html().includes(`No. ${first.id}`));
  if(value==='role')assert.ok(b.html().includes(`data-phrase-id="${first.id}"`));
 }
});
test('シチュエーションを変更した後に古い自動遷移が混ざらない',()=>{
 const b=boot({sr:true});b.click('tab',{value:'speak'});b.click('situation-select',{value:'カフェ'});b.click('recognize');b.recognizers[0].deliver({results:[[{transcript:'Can I get a latte'}]]});const old=[...b.timeouts.values()].find(t=>t.ms===1100);b.click('situations-back');b.click('situation-select',{value:'空港・機内'});old.fn();assert.match(b.html(),/I’m checking in for my flight/);assert.match(b.html(),/1 \/ 30/);
});
test('会話開始後は各ターンの入力・再生ボタンなしで進み、一時停止だけ表示',()=>{
 const b=boot({sr:true});b.click('tab',{value:'role'});b.click('situation-select',{value:'すべて'});assert.match(b.html(),/data-action="conversation-start"/);b.click('conversation-start');assert.match(b.html(),/data-action="conversation-pause"/);assert.doesNotMatch(b.html(),/role-next|role-recognize|role-line-audio|id="recognize-start"/);assert.equal(b.recognizers.length,0);b.finishPartner();assert.equal(b.recognizers.length,1);
});
test('会話の認識サービス拒否はその場で止まり、再開可能',()=>{
 const b=boot({sr:true});b.click('tab',{value:'role'});b.click('situation-select',{value:'すべて'});b.change('my-role','A');b.click('conversation-start');b.recognizers[0].onerror({error:'not-allowed'});assert.match(b.html(),/許可されていません/);assert.match(b.html(),/再開/);assert.equal(b.recognizers.length,1);b.click('conversation-start');assert.equal(b.recognizers.length,2);
});
test('会話中に場面へ戻ると、遅れて届く音声完了でもマイクを開かない',()=>{
 const b=boot({sr:true});b.click('tab',{value:'role'});b.click('situation-select',{value:'カフェ'});b.click('conversation-start');const old=b.spoken.at(-1).onend;b.click('situations-back');old();assert.equal(b.recognizers.length,0);assert.match(b.html(),/situation-grid/);
});
test('教材・分岐のスタートと一時停止を会話文より上に一つだけ配置',()=>{
 const b=boot({sr:true});b.click('tab',{value:'role'});b.click('situation-select',{value:'カフェ'});
 for(const mode of ['role-textbook','role-branch']){b.click(mode);assert.ok(b.html().indexOf('data-action="conversation-start"')<b.html().indexOf('class="dialogue'));assert.equal((b.html().match(/data-action="conversation-start"/g)||[]).length,1);b.click('conversation-start');assert.ok(b.html().indexOf('data-action="conversation-pause"')<b.html().indexOf('class="dialogue'));b.click('conversation-pause');}
});
function completeTextbook(b,p,role='A'){
 b.change('my-role',role);b.click('conversation-start');for(const d of p.dialogue){if(d.role===role){b.recognizers.at(-1).deliver({results:[[{transcript:d.text}]]});b.advanceFeedback();}else b.finishPartner();}
}
test('完了時にもう一度と次へを並べ、次へで同じ場面の次教材を準備',()=>{
 const b=boot({sr:true});b.click('tab',{value:'role'});b.click('situation-select',{value:'カフェ'});b.click('conversation-next');assert.match(b.html(),/data-phrase-id="54"/);completeTextbook(b,data.find(p=>p.id===54));assert.match(b.html(),/conversation-finish-actions/);assert.match(b.html(),/data-action="conversation-restart"/);assert.match(b.html(),/data-action="conversation-next"/);
 const count=b.recognizers.length;b.click('conversation-next');assert.match(b.html(),/data-phrase-id="55"/);assert.match(b.html(),/<option value="A" selected>/);assert.match(b.html(),/data-action="conversation-start"/);assert.equal(b.recognizers.length,count);assert.doesNotMatch(b.html(),/conversation-complete/);
});
test('場面の最後の教材で次へを押すと同じ場面の先頭へ戻る',()=>{
 const b=boot({sr:true});b.click('tab',{value:'role'});b.click('situation-select',{value:'カフェ'});for(const p of data.filter(p=>p.category==='カフェ')){completeTextbook(b,p);b.click('conversation-next');}assert.match(b.html(),/data-phrase-id="54"/);assert.match(b.html(),/カフェ/);
});
test('追加分岐の完了後の次へも選んだ場面の次の教材フレーズへ進む',()=>{
 const b=boot({sr:true});b.click('tab',{value:'role'});b.click('situation-select',{value:'カフェ'});b.click('role-branch');b.click('conversation-start');b.finishPartner();b.recognizers.at(-1).deliver({results:[[{transcript:'Can I get a latte'}]]});b.advanceFeedback();b.finishPartner();b.recognizers.at(-1).deliver({results:[[{transcript:'I’m having it here.'}]]});b.advanceFeedback();b.finishPartner();b.click('conversation-next');assert.match(b.html(),/data-phrase-id=/);assert.match(b.html(),/data-phrase-id="55"/);assert.match(b.html(),/data-action="conversation-start"/);
});

test('会話の先頭に対象フレーズと日本語訳を表示し、その下に全文を配置',()=>{
 const b=boot();b.click('tab',{value:'role'});b.click('situation-select',{value:'カフェ'});assert.match(b.html(),/<h2 class="practice-target" lang="en">Can I get a latte\?<\/h2>/);assert.match(b.html(),/カフェラテをください/);assert.ok(b.html().indexOf('practice-target')<b.html().indexOf('class="dialogue full-script"'));
 for(const line of data.find(p=>p.id===54).dialogue)assert.ok(b.html().includes(line.text));
});
test('場面・会話の選択欄を削除し、役割選択とスタートは残す',()=>{
 const b=boot();b.click('tab',{value:'role'});b.click('situation-select',{value:'カフェ'});assert.doesNotMatch(b.html(),/id="role-category"|id="role-id"/);assert.match(b.html(),/id="my-role"/);assert.match(b.html(),/data-action="conversation-start"/);b.click('role-branch');assert.doesNotMatch(b.html(),/id="branch-id"/);
});
test('追加会話タブのラベルをExtra Practiceに変更',()=>{
 const b=boot();b.click('tab',{value:'role'});b.click('situation-select',{value:'カフェ'});assert.match(b.html(),/data-action="role-branch"[^>]*>Extra Practice<\/button>/);assert.doesNotMatch(b.html(),/>追加の分岐会話</);
});
test('新教材40件を予定の配分で追加し、ID・英文は重複しない',()=>{
 const added=data.slice(129,169);assert.equal(added.length,40);assert.deepEqual(added.map(p=>p.id),Array.from({length:40},(_,i)=>130+i));assert.equal(new Set(data.map(p=>p.en.toLowerCase())).size,193);
 for(const [cat,count] of [['ホームステイ',8],['学校・授業での交流',6],['科学研修・施設見学',6],['バス・電車での移動',6],['体調・困ったとき',6]])assert.equal(added.filter(p=>p.category===cat).length,count);
 assert.equal(added.filter(p=>data.slice(0,129).some(old=>old.category===p.category)).length,8);
});
test('追加全40件に日本語・対象フレーズを含むA/B会話があり、音声照合できる',()=>{
 const {ctx}=boot();for(const p of data.slice(129,169)){assert.equal(p.source,'研修向け追加教材');assert.ok(p.ja.length>0);assert.equal(p.dialogue.length,4);assert.deepEqual(p.dialogue.map(d=>d.role),['A','B','A','B']);assert.ok(p.dialogue.some(d=>d.text.includes(p.en)));assert.equal(ctx.AussieCore.spokenCheck(p.en,p.en).score,100);}
});
test('件数表示を193に更新し、全12場面が4モードで選択できる',()=>{
 const b=boot();assert.match(b.html(),/193 PHRASES/);assert.match(b.elements.get('nav').innerHTML,/>193<\/span>/);assert.match(b.html(),/\/ 193/);
 for(const mode of ['learn','speak','quiz','role']){b.click('tab',{value:mode});b.click('situations-back');for(const cat of [...new Set(data.map(p=>p.category))])assert.ok(b.html().includes(`data-value="${cat}"`),cat);}
});
test('新規5場面のExtra Practiceは自動会話を最後まで完走できる',()=>{
 const mapping={'ホームステイ':'homestay','学校・授業での交流':'school-exchange','科学研修・施設見学':'science-tour','バス・電車での移動':'public-transport','体調・困ったとき':'ask-for-help'};
 for(const [cat,id] of Object.entries(mapping)){
  const b=boot({sr:true});b.click('tab',{value:'role'});b.click('situation-select',{value:cat});b.click('role-branch');const scenario=b.ctx.BRANCHES.find(s=>s.id===id);let node=scenario.nodes[scenario.start];b.click('conversation-start');
  for(let i=0;i<10;i++){b.finishPartner();if(!node.options.length)break;const option=node.options[0];b.recognizers.at(-1).deliver({results:[[{transcript:option.en}]]});b.advanceFeedback();node=scenario.nodes[option.next];}
  assert.match(b.html(),/Good on ya!/);assert.equal(Object.values(b.saved().days)[0],1);
 }
});
test('既存129件の学習記録を保持したまま新教材を未学習で追加',()=>{
 const done=Object.fromEntries(data.slice(0,129).map(p=>[p.id,true]));const b=boot({stored:{done,star:{54:true},attempts:{54:8}}});assert.match(b.html(),/<strong>129<small> \/ 193/);b.click('tab',{value:'learn'});b.click('situation-select',{value:'ホームステイ'});assert.match(b.html(),/No. 130/);assert.match(b.html(),/>覚えた！<\/button>/);b.click('done');assert.equal(b.saved().done[54],true);assert.equal(b.saved().attempts[54],8);assert.equal(b.saved().done[130],true);
});

test('ホームに記録・苦手・復元を統合し、旧記録URLもホームに案内',()=>{
 const b=boot({hash:'#progress',stored:{star:{54:true},done:{1:true},attempts:{1:2}}});
 assert.doesNotMatch(b.elements.get('nav').innerHTML,/data-value="progress"/);
 assert.match(b.html(),/G’day/);assert.match(b.html(),/学びの足あと/);assert.match(b.html(),/記録のバックアップ/);
 assert.equal((b.html().match(/class="stats"/g)||[]).length,1);
 b.click('select',{id:'54'});assert.match(b.html(),/No. 054/);assert.match(b.html(),/フレーズ学習/);
});
test('旅行3場面に各8フレーズと会話を追加し、前の169教材も保持',()=>{
 const added=data.slice(169);assert.equal(added.length,24);
 for(const cat of ['カフェ','空港・機内','観光'])assert.equal(added.filter(p=>p.category===cat).length,8);
 for(const p of added){assert.ok(p.ja);assert.deepEqual(p.dialogue.map(d=>d.role),['A','B','A']);assert.equal(p.dialogue[0].text,p.en);}
});
test('発音の1・3・5回達成を自動通知し、誤答は段階を進めない',()=>{
 const b=boot({sr:true});b.click('tab',{value:'speak'});b.click('situation-select',{value:'カフェ'});
 b.click('recognize');b.recognizers.at(-1).deliver({results:[[{transcript:'wrong answer'}]]});assert.equal(b.elements.get('result-symbol').textContent,'×');b.advanceFeedback();
 for(let i=0;i<5;i++){
  b.click('recognize');b.recognizers.at(-1).deliver({results:[[{transcript:data.filter(p=>p.category==='カフェ')[i].en}]]});
  if([0,2,4].includes(i)){assert.equal(b.elements.get('result-feedback')['data-kind'],'milestone');assert.match(b.elements.get('result-label').textContent,new RegExp(`${i+1}回クリア`));}
  b.advanceFeedback();assert.equal(b.elements.get('result-feedback').hidden,true);
 }
});

test('今日の5分は誤答・苦手・未学習を優先し、重複のない5件を同日固定',()=>{
 const {ctx}=boot(),C=ctx.AussieCore,s=C.cleanState({done:Object.fromEntries(data.map(p=>[p.id,true])),star:{54:true},quiz:{'67:en':{total:1,correct:0,lastWrong:true}},attempts:{67:10}},data);delete s.done[88];
 const plan=C.dailyPlan(data,s,'2026-11-21');assert.equal(plan.ids.length,5);assert.equal(new Set(plan.ids).size,5);assert.equal(plan.ids[0],67);assert.equal(plan.ids[1],54);assert.equal(plan.ids[2],88);
 s.daily={...plan,completed:[67]};s.star[12]=true;
 assert.equal(JSON.stringify(C.dailyPlan(data,s,'2026-11-21')),JSON.stringify(s.daily));
 const next=C.dailyPlan(data,s,'2026-11-22');assert.equal(next.completed.length,0);assert.equal(next.date,'2026-11-22');assert.notEqual(JSON.stringify(next.ids),JSON.stringify(plan.ids));
});
test('5分コースの不正な保存値を除去し、既存学習記録は保持する',()=>{
 const {ctx}=boot(),C=ctx.AussieCore;
 const s=C.cleanState({done:{1:true},daily:{date:'2026-11-21',ids:[1,1,2,3,4,5,999],completed:[1,1,999,2]}},data);
 assert.deepEqual(Array.from(s.daily.ids),[1,2,3,4,5]);assert.deepEqual(Array.from(s.daily.completed),[1,2]);assert.equal(s.done[1],true);
 for(const daily of [{date:'invalid',ids:[1,2,3,4,5]},{date:'2026-11-21',ids:[1,2,999]},{date:'2026-11-21',ids:'bad'}])assert.equal(C.cleanState({daily},data).daily,undefined);
});
test('5分コースは自己確認で保存し、画面移動・再読み込み後に途中から再開できる',()=>{
 const b=boot();assert.match(b.html(),/今日の5分コース/);b.click('daily-start');assert.match(b.html(),/1 \/ 5/);const first=b.saved().daily.ids[0];
 b.click('daily-self');assert.equal(b.saved().done[first],true);assert.equal(b.saved().daily.completed.length,1);assert.equal(b.saved().attempts[first],1);assert.equal(b.saved().quiz?.[`${first}:en`],undefined);
 b.click('daily-home');assert.match(b.html(),/つづきから/);assert.match(b.html(),/1 \/ 5 完了/);
 const restored=boot({stored:b.saved()});restored.click('daily-start');assert.match(restored.html(),/2 \/ 5/);assert.equal(restored.saved().daily.completed[0],first);
});
test('5分コースは不一致で進まず、一致で保存・自動進行して5件で完了する',()=>{
 const b=boot({sr:true});b.click('daily-start');b.click('daily-recognize');b.recognizers.at(-1).deliver({results:[[{transcript:'wrong answer'}]]});assert.equal(b.saved().daily.completed.length,0);assert.equal(b.elements.get('result-symbol').textContent,'×');b.advanceFeedback();
 for(let i=0;i<5;i++){
  const id=b.saved().daily.ids[i],en=data.find(p=>p.id===id).en.split(/\s*\/\s*/)[0].replace(/(\S+)\s*\([^)]+\)/g,'$1');
  b.click('daily-recognize');b.recognizers.at(-1).deliver({results:[[{transcript:en}]]});
  assert.equal(b.saved().daily.completed.length,i+1);b.advanceFeedback();
 }
 assert.match(b.html(),/今日の5フレーズ、完了/);assert.equal(b.saved().daily.completed.length,5);assert.equal(b.elements.get('result-label').textContent,'Good on ya!');
 b.click('daily-home');b.click('daily-start');assert.match(b.html(),/今日の5フレーズ、完了/);b.click('daily-repeat');assert.match(b.html(),/1 \/ 5/);assert.equal(b.saved().daily.completed.length,0);
});
test('5分で正解した後に移動すると古い自動遷移を実行しない',()=>{
 const b=boot({sr:true});b.click('daily-start');const id=b.saved().daily.ids[0];b.click('daily-recognize');b.recognizers.at(-1).deliver({results:[[{transcript:data.find(p=>p.id===id).en.split(/\s*\/\s*/)[0].replace(/(\S+)\s*\([^)]+\)/g,'$1')}]]});
 const old=[...b.timeouts.values()].find(t=>t.ms===1100);b.click('daily-home');old.fn();assert.match(b.html(),/G’day/);assert.equal(b.saved().daily.completed.length,1);
});
test('5分の音声認識中にホームへ戻っても遅延結果は記録されない',()=>{
 const b=boot({sr:true});b.click('daily-start');const id=b.saved().daily.ids[0];b.click('daily-recognize');const old=b.recognizers.at(-1);b.click('daily-home');old.deliver({results:[[{transcript:data.find(p=>p.id===id).en.split(/\s*\/\s*/)[0].replace(/(\S+)\s*\([^)]+\)/g,'$1')}]]});assert.equal(b.saved().daily.completed.length,0);assert.match(b.html(),/G’day/);
});
test('教材の全会話とExtra Practiceに日本語訳が揃い、生成データと一致する',()=>{
 const b=boot(),dictionary=JSON.parse(read('dialogue-ja.json'));
 assert.equal(JSON.stringify(b.ctx.DIALOGUE_JA),JSON.stringify(dictionary));
 const lines=[...data.flatMap(p=>p.dialogue.map(d=>d.text)),...b.ctx.BRANCHES.flatMap(scene=>Object.values(scene.nodes).flatMap(n=>[n.partner,...n.options.map(o=>o.en)]))];
 for(const en of lines)assert.match(dictionary[en],/[ぁ-んァ-ヶ一-龠]/,en);
});
test('教材会話では各英文の下に日本語訳を表示し、両役の練習でも維持する',()=>{
 const b=boot({sr:true});b.click('tab',{value:'role'});b.click('situation-select',{value:'すべて'});
 for(const line of data[0].dialogue)assert.ok(b.html().includes(b.ctx.DIALOGUE_JA[line.text]));assert.equal((b.html().match(/class="dialogue-ja"/g)||[]).length,4);
 b.change('my-role','A');b.click('conversation-start');assert.match(b.html(),/やあ！調子はどう/);b.recognizers[0].deliver({results:[[{transcript:data[0].dialogue[0].text}]]});b.advanceFeedback();assert.match(b.html(),/とてもいいよ/);
});
test('分岐会話は相手・選択肢・回答ログにも日本語訳を表示する',()=>{
 const b=boot({sr:true});b.click('tab',{value:'role'});b.click('situation-select',{value:'カフェ'});b.click('role-branch');assert.match(b.html(),/ご注文は何になさいますか/);assert.match(b.html(),/ラテ/);
 b.click('conversation-start');b.finishPartner();b.recognizers[0].deliver({results:[[{transcript:'Can I get a latte'}]]});b.advanceFeedback();assert.match(b.html(),/カフェラテをください/);assert.match(b.html(),/店内か持ち帰りか/);
});
test('12場面のイラスト参照先が存在し、4モードに個別のテーマを設定する',()=>{
 const svg=read('assets/scenes.svg'),b=boot();
 for(const mode of ['learn','speak','quiz','role']){
  b.click('tab',{value:mode});assert.equal(b.elements.get('app')['data-mode'],mode);
  assert.equal((b.html().match(/class="scene-art"/g)||[]).length,12);
  for(let i=0;i<12;i++){assert.ok(b.html().includes(`assets/scenes.svg#scene-${i}`));assert.ok(svg.includes(`id="scene-${i}"`));}
 }
});
