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
 confirm:()=>true,setTimeout:(fn,ms)=>{timeouts.set(++timer,{fn,ms});return timer;},clearTimeout:id=>timeouts.delete(id),
 speechSynthesis:{cancel(){},getVoices:()=>[{name:'US voice',lang:'en-US'},{name:'Aussie',lang:'en-AU'}],speak:u=>spoken.push(u),addEventListener(){}},
 SpeechSynthesisUtterance:class{constructor(text){this.text=text;}},addEventListener:(t,fn)=>events[t]=fn,scrollTo(){}};
 if(sr)ctx.SpeechRecognition=Recognition;ctx.window=ctx;
 vm.createContext(ctx);for(const f of ['phrases.js','core.js','speech.js','feedback.js','scenarios.js','app.js'])vm.runInContext(read(f),ctx,{filename:f});
 const click=(action,props={})=>events.click({target:{closest:()=>({dataset:{action,...props},disabled:false})}});
 const advanceFeedback=()=>{[...timeouts.values()].find(t=>t.ms===1100)?.fn();};
 const flush=()=>new Promise(resolve=>setImmediate(resolve));
 const change=(id,value,checked)=>events.change({target:{id,value,checked}});
 const input=(id,value)=>{elements.get(id).value=value;events.input({target:{id,value}});};
 const saved=()=>JSON.parse(storage.get('aussie-english-v1')||'{}');
 return {ctx,elements,events,click,advanceFeedback,change,input,saved,spoken,tracks,recorders,recognizers,revokes,urls,timeouts,flush,html:()=>elements.get('app').innerHTML};
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
 b.click('tab',{value:'learn'});b.click('situation-select',{value:'すべて'});assert.match(b.html(),/✓ 学習済み/);b.click('star');const s=b.saved();assert.equal(s.attempts[1],5);assert.equal(s.attempts[2],0);assert.equal(s.done[999],undefined);assert.equal(s.quiz['1:en'].correct,2);
});
test('検索・カテゴリー・苦手絞り込み・英日非表示は一覧にも反映',()=>{
 const b=boot();b.click('tab',{value:'learn'});b.click('situation-select',{value:'すべて'});b.input('search','ラテ');assert.match(b.elements.get('learn-content').innerHTML,/Can I get a latte/);
 b.input('search','<script>');assert.match(b.elements.get('learn-content').innerHTML,/見つかりませんでした/);
 b.click('clear-filter');b.change('category','カフェ');assert.match(b.html(),/No. 054/);b.click('star');b.change('only-star','',true);assert.match(b.html(),/1 フレーズ/);
 b.click('toggle-en');assert.doesNotMatch(b.html(),/Can I get a latte/);b.click('toggle-ja');assert.doesNotMatch(b.html(),/ラテを/);
});
test('双方向の暗記・二重回答防止・誤答優先復習・正答率・学習回数',()=>{
 const b=boot();b.click('tab',{value:'quiz'});b.click('situation-select',{value:'すべて'});b.click('quiz-reveal');b.click('quiz-wrong');b.click('quiz-wrong');let s=b.saved();assert.equal(s.quiz['1:en'].total,1);assert.equal(s.star[1],true);
 b.click('quiz-next');assert.match(b.html(),/No. 2/);b.click('quiz-reveal');b.click('quiz-correct');b.click('quiz-next');assert.match(b.html(),/前回の復習/);
 b.click('quiz-ja');assert.match(b.html(),/意味を日本語で話そう/);b.click('quiz-reveal');b.click('quiz-correct');s=b.saved();assert.equal(s.quiz['1:ja'].correct,1);assert.equal(s.sessions,1);
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
test('教材ロールプレイはA/B両役で完了できる',()=>{
 const b=boot();b.click('tab',{value:'role'});b.click('situation-select',{value:'すべて'});b.change('my-role','A');for(let i=0;i<data[0].dialogue.length;i++)b.click('role-next');assert.match(b.html(),/会話完了/);assert.equal(b.saved().attempts[1],1);
});
test('4場面の分岐は全ノード到達可能、全選択先が存在、終了に到達',()=>{
 const {ctx}=boot();assert.equal(ctx.BRANCHES.length,4);
 for(const b of ctx.BRANCHES){const visited=new Set(),walk=id=>{if(visited.has(id))return;visited.add(id);const node=b.nodes[id];assert.ok(node);for(const o of node.options){assert.ok(b.nodes[o.next]);walk(o.next);}};walk(b.start);assert.equal(visited.size,Object.keys(b.nodes).length);assert.ok([...visited].some(id=>b.nodes[id].options.length===0));}
});
test('分岐練習の会話完了は重複カウントしない',()=>{
 const b=boot();b.click('tab',{value:'role'});b.click('situation-select',{value:'すべて'});b.click('role-branch');b.click('branch-hear');b.click('branch-choice',{index:'0'});b.click('branch-hear');b.click('branch-choice',{index:'0'});b.click('branch-hear');b.click('branch-hear');assert.match(b.html(),/会話完了/);assert.equal(Object.values(b.saved().days)[0],1);
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


test('全129会話は空でなく、選択可能なA/B役がある',()=>{
 for(const p of data){assert.ok(p.dialogue.length>=2);assert.ok(p.dialogue.some(d=>d.role==='A'));assert.ok(p.dialogue.some(d=>d.role==='B'));for(const d of p.dialogue)assert.ok(typeof d.text==='string'&&d.text.length>0);}
});

test('両学習画面からゆっくり聞くを削除、クイズに入力欄がない',()=>{
 const b=boot();for(const value of ['learn','speak']){b.click('tab',{value});assert.doesNotMatch(b.html(),/ゆっくり聞く|speak-slow/);}
 b.click('tab',{value:'quiz'});b.click('situation-select',{value:'すべて'});assert.doesNotMatch(b.html(),/<textarea|quiz-input/);assert.match(b.html(),/話して答える/);
});
test('英語の音声回答が一致すると○表示、正解を一度だけ記録',()=>{
 const b=boot({sr:true});b.click('tab',{value:'quiz'});b.click('situation-select',{value:'すべて'});b.click('quiz-recognize');const r=b.recognizers[0];assert.equal(r.lang,'en-AU');
 const callback=r.onresult;callback({results:[[{transcript:'How is it going?'}]]});r.onend?.();
 assert.equal(b.saved().quiz['1:en'].correct,1);assert.equal(b.elements.get('result-feedback').hidden,false);assert.equal(b.elements.get('result-symbol').textContent,'○');assert.match(b.elements.get('result-label').textContent,/一致/);
 callback({results:[[{transcript:'How is it going?'}]]});b.click('quiz-correct');assert.equal(b.saved().quiz['1:en'].total,1);
 b.advanceFeedback();assert.equal(b.elements.get('result-feedback').hidden,true);
});
test('認識が違う場合は即誤答にせず再挑戦・自己確認、×を表示',()=>{
 const b=boot({sr:true});b.click('tab',{value:'quiz'});b.click('situation-select',{value:'すべて'});b.click('quiz-recognize');b.recognizers[0].deliver({results:[[{transcript:'Sorry'}]]});
 assert.notEqual(b.elements.get('result-symbol').textContent,'○');assert.equal(b.saved().quiz?.['1:en'],undefined);assert.match(b.html(),/もう一度話す/);
 b.click('quiz-wrong');assert.equal(b.saved().quiz['1:en'].misses,1);assert.equal(b.saved().star[1],true);
});
test('日本語の意味はja-JPで認識、一致時のGOOD、言い換えは自己確認',()=>{
 const b=boot({sr:true});b.click('tab',{value:'quiz'});b.click('situation-select',{value:'すべて'});b.click('quiz-ja');b.click('quiz-recognize');assert.equal(b.recognizers[0].lang,'ja-JP');
 b.recognizers[0].deliver({results:[[{transcript:'調子はどう'}]]});assert.equal(b.saved().quiz['1:ja'].correct,1);assert.equal(b.elements.get('result-feedback').hidden,false);assert.equal(b.elements.get('result-symbol').textContent,'○');
 b.advanceFeedback();b.click('quiz-next');b.click('quiz-recognize');b.recognizers[1].deliver({results:[[{transcript:'元気です。あなたは'}]]});assert.match(b.html(),/自分でも確認/);assert.equal(b.saved().quiz['2:ja'],undefined);
});
test('音声非対応時は自己確認を記録し、○による音声一致とは区別',()=>{
 const b=boot();b.click('tab',{value:'quiz'});b.click('situation-select',{value:'すべて'});assert.match(b.html(),/認識に非対応/);b.click('quiz-reveal');b.click('quiz-correct');assert.equal(b.saved().quiz['1:en'].correct,1);assert.notEqual(b.elements.get('result-symbol').textContent,'○');
});
test('全文表示ロールプレイは開始前から両役の全セリフが見える',()=>{
 const b=boot();b.click('tab',{value:'role'});b.click('situation-select',{value:'すべて'});for(const d of data[0].dialogue)assert.ok(b.html().includes(d.text.replaceAll('’','’')),d.text);assert.match(b.html(),/aria-current="step"/);assert.match(b.html(),/会話の全文/);assert.doesNotMatch(b.html(),/セリフのヒント/);
 b.click('role-line-audio',{index:'2'});assert.equal(b.spoken.at(-1).text,data[0].dialogue[2].text);
 b.click('role-next');assert.match(b.html(),/completed-turn/);assert.match(b.html(),/あなたの番/);
});
test('クイズの方向変更・次問・画面移動で古い認識結果を破棄',()=>{
 const b=boot({sr:true});b.click('tab',{value:'quiz'});b.click('situation-select',{value:'すべて'});b.click('quiz-recognize');const old=b.recognizers[0].onresult;b.click('quiz-ja');old({results:[[{transcript:'How is it going?'}]]});assert.equal(b.saved().quiz?.['1:en'],undefined);assert.match(b.html(),/意味を日本語/);
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
 const b=boot();assert.equal((b.elements.get('nav').innerHTML.match(/data-action="tab"/g)||[]).length,6);assert.doesNotMatch(b.html(),/data-action="tab"|start-learn|mode-grid/);
 for(const value of ['learn','speak','quiz','role']){b.click('tab',{value});assert.doesNotMatch(b.html(),/録音|聞き直|record-stop|playback/);}
 assert.doesNotMatch(read('app.js')+read('speech.js'),/MediaRecorder|getUserMedia|recordingUrl/);
});
test('発音練習で全体が一致したときGOOD、欠落があれば表示しない',()=>{
 const b=boot({sr:true});b.click('tab',{value:'speak'});b.click('situation-select',{value:'すべて'});b.click('recognize');b.recognizers[0].deliver({results:[[{transcript:'How is it going'}]]});assert.equal(b.elements.get('result-feedback').hidden,false);assert.equal(b.elements.get('result-symbol').textContent,'○');
 b.advanceFeedback();b.click('recognize');b.recognizers[1].deliver({results:[[{transcript:'How is going'}]]});assert.equal(b.elements.get('result-symbol').textContent,'×');
});
test('教材会話は一致なら○と次の番、不一致なら同じ番で再挑戦',()=>{
 const b=boot({sr:true});b.click('tab',{value:'role'});b.click('situation-select',{value:'すべて'});b.change('my-role','A');b.click('role-recognize');b.recognizers[0].deliver({results:[[{transcript:'Sorry'}]]});assert.notEqual(b.elements.get('result-symbol').textContent,'○');assert.match(b.html(),/1 \/ 4/);
 b.click('role-recognize');b.recognizers[1].deliver({results:[[{transcript:data[0].dialogue[0].text}]]});assert.equal(b.elements.get('result-feedback').hidden,false);assert.equal(b.elements.get('result-symbol').textContent,'○');b.advanceFeedback();assert.match(b.html(),/2 \/ 4/);
});
test('分岐会話も声で返答し、一致すると○と次の分岐へ進む',()=>{
 const b=boot({sr:true});b.click('tab',{value:'role'});b.click('situation-select',{value:'すべて'});b.click('role-branch');b.click('branch-hear');b.click('branch-recognize');b.recognizers[0].deliver({results:[[{transcript:'Can I get a latte'}]]});assert.equal(b.elements.get('result-feedback').hidden,false);assert.equal(b.elements.get('result-symbol').textContent,'○');b.advanceFeedback();assert.match(b.html(),/Having here, or take away/);
});
test('発話終了イベントでstopし、遅い確定結果を自動判定',()=>{
 const b=boot({sr:true});b.click('tab',{value:'speak'});b.click('situation-select',{value:'すべて'});b.click('recognize');const r=b.recognizers[0];const interim=[{transcript:'How is it'}];interim.isFinal=false;r.onresult({results:[interim]});assert.equal(b.elements.get('speech-transcript').textContent,'How is it');r.onspeechend();assert.equal(r.stopped,true);assert.notEqual(r.aborted,true);r.deliver({results:[[{transcript:'How is it going'}]]});assert.equal(b.elements.get('result-feedback').hidden,false);assert.equal(b.elements.get('result-symbol').textContent,'○');
});

test('フレーズは最初に7シチュエーションを表示し、選択後だけフレーズを表示',()=>{
 const b=boot();b.click('tab',{value:'learn'});assert.match(b.html(),/どこで話す/);assert.match(b.html(),/situation-grid/);assert.doesNotMatch(b.html(),/No. 001|learn-content/);
 b.click('situation-select',{value:'カフェ'});assert.match(b.html(),/No. 054/);assert.match(b.html(),/13 フレーズ/);assert.doesNotMatch(b.html(),/situation-grid/);
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
test('暗記は正解後自動で次問へ、会話の手動スキップと自動遷移は二重実行しない',()=>{
 const q=boot({sr:true});q.click('tab',{value:'quiz'});q.click('situation-select',{value:'すべて'});q.click('quiz-recognize');q.recognizers[0].deliver({results:[[{transcript:'How is it going'}]]});q.advanceFeedback();assert.match(q.html(),/No. 2/);
 const b=boot({sr:true});b.click('tab',{value:'role'});b.click('situation-select',{value:'すべて'});b.change('my-role','A');b.click('role-recognize');b.recognizers[0].deliver({results:[[{transcript:data[0].dialogue[0].text}]]});const old=[...b.timeouts.values()].find(t=>t.ms===1100);b.click('role-next');old.fn();assert.match(b.html(),/2 \/ 4/);
});
test('全4学習モードは最初にシチュエーションを選び、選び直せる',()=>{
 const b=boot();for(const value of ['learn','speak','quiz','role']){
  b.click('tab',{value});assert.match(b.html(),/situation-grid/);assert.doesNotMatch(b.html(),/id="recognize-start"|id="role-id"|id="quiz-input"/);
  b.click('situation-select',{value:'カフェ'});assert.doesNotMatch(b.html(),/situation-grid/);assert.match(b.html(),/カフェ/);
  b.click('situations-back');assert.match(b.html(),/situation-grid/);
 }
});
test('発音練習の前後移動と正解後の自動移動は選択シーンの範囲で循環',()=>{
 const b=boot({sr:true});b.click('tab',{value:'speak'});b.click('situation-select',{value:'カフェ'});assert.match(b.html(),/Can I get a latte/);assert.match(b.html(),/1 \/ 13/);
 b.click('prev');assert.match(b.html(),/Can I get the bill/);assert.match(b.html(),/13 \/ 13/);b.click('recognize');b.recognizers[0].deliver({results:[[{transcript:'Can I get the bill'}]]});b.advanceFeedback();assert.match(b.html(),/Can I get a latte/);assert.match(b.html(),/1 \/ 13/);
});
test('暗記の誤答優先・次問・出題方向変更も選択シーン外を出題しない',()=>{
 const b=boot({stored:{done:{},star:{1:true},quiz:{'1:en':{total:5,correct:0,misses:5,lastWrong:true},'55:en':{total:1,correct:0,misses:1,lastWrong:true}}}});
 b.click('tab',{value:'quiz'});b.click('situation-select',{value:'カフェ'});assert.match(b.html(),/No. 55/);
 for(let i=0;i<20;i++){const id=Number(b.html().match(/No\. (\d+)/)[1]);assert.ok(id>=54&&id<=66);b.click('quiz-reveal');b.click('quiz-correct');b.click('quiz-next');}
 b.click('quiz-ja');const id=Number(b.html().match(/No\. (\d+)/)[1]);assert.ok(id>=54&&id<=66);
});
test('教材会話の候補と追加分岐を選択シーンに限定',()=>{
 const b=boot();b.click('tab',{value:'role'});b.click('situation-select',{value:'カフェ'});
 const select=b.html().match(/<select id="role-id">([\s\S]*?)<\/select>/)[1];const ids=[...select.matchAll(/value="(\d+)"/g)].map(x=>Number(x[1]));assert.equal(ids.length,13);assert.ok(ids.every(id=>id>=54&&id<=66));
 b.click('role-branch');assert.match(b.html(),/value="cafe"/);assert.doesNotMatch(b.html(),/value="airport"|value="school"|value="daily"/);
 b.click('situations-back');b.click('situation-select',{value:'空港・機内'});b.click('role-branch');assert.match(b.html(),/value="airport"/);assert.doesNotMatch(b.html(),/value="cafe"/);
 b.click('situations-back');b.click('situation-select',{value:'リアクション・フィラー'});assert.doesNotMatch(b.html(),/data-action="role-branch"/);assert.match(b.html(),/id="role-id"/);
});
test('7シチュエーションは発音・暗記・会話のどのモードでも対象教材に一致',()=>{
 const b=boot();for(const value of ['speak','quiz','role'])for(const cat of [...new Set(data.map(p=>p.category))]){
  b.click('tab',{value});b.click('situations-back');b.click('situation-select',{value:cat});const first=data.find(p=>p.category===cat);assert.match(b.html(),new RegExp(cat));
  if(value==='quiz')assert.ok(b.html().includes(`No. ${first.id}`));
  if(value==='role')assert.ok(b.html().includes(`<option value="${first.id}" selected>`));
 }
});
test('シチュエーションを変更した後に古い自動遷移が混ざらない',()=>{
 const b=boot({sr:true});b.click('tab',{value:'speak'});b.click('situation-select',{value:'カフェ'});b.click('recognize');b.recognizers[0].deliver({results:[[{transcript:'Can I get a latte'}]]});const old=[...b.timeouts.values()].find(t=>t.ms===1100);b.click('situations-back');b.click('situation-select',{value:'空港・機内'});old.fn();assert.match(b.html(),/I’m checking in for my flight/);assert.match(b.html(),/1 \/ 21/);
});
