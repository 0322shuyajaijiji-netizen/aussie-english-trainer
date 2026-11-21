/* 無料の静的アプリ。通信ライブラリ・外部API・トラッカーは使用しません。 */
(() => {
'use strict';
const DATA=window.PHRASES||[], C=window.AussieCore, KEY='aussie-english-v1';
const $=id=>document.getElementById(id), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ids=new Set(DATA.map(p=>String(p.id)));
let storageIssue='', state;
try {state=C.cleanState(JSON.parse(localStorage.getItem(KEY)||'{}'),DATA);} catch(e) {state=C.cleanState({},DATA);storageIssue='保存済みデータを読み込めません。この画面では一時的に学習できます。必要なら記録のバックアップを復元してください。';}
let tab='home', selected=DATA[0]?.id, search='', category='すべて', onlyStar=false, showEn=true, showJa=true;
const stages={learn:'situations',speak:'situations',quiz:'situations',role:'situations'};
let speakCategory='すべて',quizCategory='すべて';
let quizId=null, quizRevealed=false, quizGraded=false, quizText='', quizFeedback='', quizSource='';
let roleMode='textbook', roleCategory='すべて', roleId=1, myRole='B', roleTurn=0, roleLog=[], roleStarted=false, roleCounted=false;
let branchId='cafe', branchNode='order', branchLog=[], branchHeard=false, branchCounted=false;
let speechPhase='idle';
let conversationState={phase:'idle',running:false,message:''},conversationLast=null;
const speech=window.AussieSpeech.create({onState:updateSpeechState});
let activityStarted=false, toastTimer;
const GOOD_THRESHOLD=100;
function icon(name){const paths={home:'M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z',learn:'M4 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-2H3V4Zm9 3a3 3 0 0 1 3-3h5v15h-5a4 4 0 0 0-3 2',speak:'M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0Zm-4 6v1a7 7 0 0 0 14 0v-1M12 19v3m-4 0h8',quiz:'m6 12 4 4 8-9M21 12a9 9 0 1 1-9-9',role:'M21 11a8 8 0 0 1-8 8H7l-5 3 1-6a8 8 0 1 1 18-5ZM7 10h10m-10 4h6',progress:'M4 21V11m8 10V3m8 18V7',play:'m9 5 11 7-11 7Z',arrow:'M4 12h16m-6-6 6 6-6 6',star:'m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z'};return `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.arrow}"/></svg>`;}
const feedback=window.AussieFeedback.create({
 show:({correct,symbol,label,kind='result'})=>{const box=$('result-feedback');if(!box)return;box.hidden=false;box.setAttribute('data-correct',String(correct));box.setAttribute('data-kind',kind);$('result-symbol').textContent=symbol;$('result-label').textContent=label;},
 hide:()=>{if($('result-feedback'))$('result-feedback').hidden=true;}
});
const conversation=window.AussieConversation.create({
 getTurn:conversationTurn,
 play:(text,done,fail)=>speak(text,.9,done,fail),
 listen:(expected,onResult,onError)=>speech.start({lang:'en-AU',expected,onResult,onError}),
 judge:(turn,text)=>{
  let expected=turn.expected,choice;
  if(roleMode==='branch'){
   const candidates=branch().nodes[branchNode].options.map((o,index)=>({index,expected:o.en,score:C.spokenCheck(o.en,text,'en').score})).sort((a,b)=>b.score-a.score);
   expected=candidates[0].expected;choice=candidates[0].index;
  }
  const correct=C.spokenCheck(expected,text,'en').score>=GOOD_THRESHOLD;
  conversationLast={expected,text};return {correct,choice};
 },
 feedback:(correct,done)=>showResult(correct,done),
 advance:advanceConversation,
 complete:()=>{
  if(roleMode==='textbook'&&!roleCounted){roleCounted=true;activity(roleId);}
  if(roleMode==='branch'&&!branchCounted){branchCounted=true;activity();}
  render();feedback.celebrate();
 },
 onState:state=>{conversationState=state;if(tab==='role'&&stages.role!=='situations')render();},
 halt:()=>{feedback.cancel();speech.cancel();window.speechSynthesis?.cancel();}
});
function conversationTurn(){
 if(roleMode==='textbook'){
  const d=rolePhrase().dialogue[roleTurn];if(!d)return null;
  return d.role===myRole?{kind:'user',expected:d.text}:{kind:'partner',text:d.text};
 }
 const node=branch().nodes[branchNode];
 if(!branchHeard)return {kind:'partner',text:node.partner};
 if(!node.options.length)return null;
 return {kind:'user',expected:node.options.map(o=>o.en).join(' / ')};
}
function advanceConversation(turn,result){
 conversationLast=null;
 if(roleMode==='textbook'){
  const d=rolePhrase().dialogue[roleTurn];if(!d)return;
  roleLog.push({role:d.role,text:result?.text||d.text});roleTurn++;
 }else if(turn.kind==='partner'){branchHeard=true;}
 else{
  const node=branch().nodes[branchNode],option=node.options[result.choice];
  branchLog.push({text:node.partner,mine:false,ja:dialogueJa(node.partner)},{text:result.text,mine:true,ja:dialogueJa(option.en)});branchNode=option.next;branchHeard=false;
 }
}
function conversationControls(){
 const s=conversationState;
 if(s.phase==='complete')return `<div class="conversation-complete"><span aria-hidden="true">✦</span><h2>Good on ya!</h2><p>会話クリア！</p><div class="conversation-finish-actions">${button('conversation-restart','もう一度')}${button('conversation-next','次へ '+icon('arrow'),'primary')}</div></div>`;
 return `<div class="role-controls auto-conversation"><p class="conversation-phase" data-phase="${esc(s.phase)}" role="status">${esc(s.message||'スタートで、会話が自動で進みます。')}</p><div class="actions">${s.running?button('conversation-pause','Ⅱ 一時停止'):button('conversation-start',icon('play')+(s.phase==='paused'?' 再開':' スタート'),'primary',speech.supported()?'':'disabled')}</div><p id="speech-state" class="speech-state" role="status"></p><p id="speech-transcript" class="speech-transcript" aria-live="polite"></p>${!speech.supported()?'<p class="tip">音声認識対応のChrome・Edge・Safariで開いてください。</p>':''}</div>`;
}
function nextConversation(){
 if(conversationState.phase!=='complete')return;
 const list=scenePool(roleCategory),at=list.findIndex(p=>p.id===roleId);
 cleanupMedia();roleId=list[(at+1+list.length)%list.length].id;roleMode='textbook';resetRole();render();
 $('main').focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});
}

function startConversation(){
 feedback.prime();conversation.start();
}

const practiceWins={speak:0,quiz:0,role:0};
function showResult(correct,onDone){
 let label='';
 const mode=tab==='daily'?'speak':tab;
 if(correct&&mode in practiceWins){
  const n=++practiceWins[mode];
  const stages={1:'はじめの一歩！',3:'いいペース！',5:'その調子！',10:'すばらしい集中力！'};
  label=stages[n]||(n%10===0?'積み重ねが力に！':'');
  if(label)label=`${n}回クリア · ${label}`;
 }
 feedback.present(correct,onDone,label?{label,kind:'milestone'}:{});
}

const navItems=[['home','⌂','ホーム'],['learn','▤','フレーズ'],['speak','♬','発音練習'],['quiz','✓','暗記チェック'],['role','☏','会話練習']];
function today(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),4500);}
function save(){try {localStorage.setItem(KEY,JSON.stringify(state));storageIssue='';}catch {storageIssue='このブラウザでは記録を保存できません。ホームからバックアップを保存してください。';toast(storageIssue);}}
function activity(id){if(id)state.attempts[id]=(state.attempts[id]||0)+1;state.days[today()]=(state.days[today()]||0)+1;if(!activityStarted){state.sessions++;activityStarted=true;}save();}
function stats(){const q=Object.values(state.quiz), total=q.reduce((n,x)=>n+x.total,0), correct=q.reduce((n,x)=>n+x.correct,0);return {done:DATA.filter(p=>state.done[p.id]).length,star:DATA.filter(p=>state.star[p.id]).length,total,correct,rate:total?Math.round(correct/total*100):null,activities:Object.values(state.days).reduce((a,b)=>a+b,0)};}
function current(){return DATA.find(p=>p.id===selected)||DATA[0];}
function options(values,value){return values.map(v=>`<option value="${esc(v)}" ${v===value?'selected':''}>${esc(v)}</option>`).join('');}
function categories(){return ['すべて',...new Set(DATA.map(p=>p.category))];}
function filtered(){const term=search.normalize('NFKC').toLowerCase().replace(/[’‘]/g,"'");return DATA.filter(p=>(category==='すべて'||p.category===category)&&(!onlyStar||state.star[p.id])&&(!term||[p.en,p.ja,p.category,String(p.id)].some(s=>s.normalize('NFKC').toLowerCase().replace(/[’‘]/g,"'").includes(term))));}
function pageHead(kicker,title,desc,right=''){return `<div class="page-head"><div><div class="eyebrow">${kicker}</div><h1>${title}</h1></div>${right}</div>`;}
function button(action,label,cls='',attrs=''){return `<button type="button" data-action="${action}" class="${cls}" ${attrs}>${label}</button>`;}
function status(message){if($('status'))$('status').textContent=message;else toast(message);}
function statsHtml(){const s=stats();return `<div class="stats"><div class="stat"><span class="stat-label">学習済み</span><strong>${s.done}<small> / ${DATA.length}</small></strong></div><div class="stat"><span class="stat-label">チェック正答率</span><strong>${s.rate===null?'—':s.rate}<small>${s.rate===null?' 未挑戦':' %'}</small></strong></div><div class="stat"><span class="stat-label">苦手フレーズ</span><strong>${s.star}<small> フレーズ</small></strong></div><div class="stat"><span class="stat-label">学習回数</span><strong>${s.activities}<small> 回</small></strong></div></div>`;}
function go(t){if(t==='progress')t='home';if(t!=='daily'&&!navItems.some(x=>x[0]===t))t='home';const previous=tab;cleanupMedia();tab=t;if(t in stages&&previous!==t)stages[t]='situations';if(t==='learn'&&previous!=='learn'){search='';onlyStar=false;}if(t==='role')resetRole();render();if(location.hash!==`#${t}`)history.replaceState(null,'',`#${t}`);$('main').focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}
function scenePool(value){return DATA.filter(p=>value==='すべて'||p.category===value);}
function situationBack(){return `<div class="situation-back">${button('situations-back','← シチュエーションを選び直す')}</div>`;}
function availableBranches(){const mapping={'カフェ':['cafe'],'空港・機内':['airport'],'あいさつ':['school'],'観光':['daily'],'ホームステイ':['homestay'],'学校・授業での交流':['school-exchange'],'科学研修・施設見学':['science-tour'],'バス・電車での移動':['public-transport'],'体調・困ったとき':['ask-for-help']};return window.BRANCHES.filter(b=>roleCategory==='すべて'||(mapping[roleCategory]||[]).includes(b.id));}

function render(){
 $('nav').innerHTML=navItems.map(([id,glyph,label])=>`<button type="button" data-action="tab" data-value="${id}" class="${(tab===id||(tab==='daily'&&id==='speak'))?'active':''}" ${(tab===id||(tab==='daily'&&id==='speak'))?'aria-current="page"':''}><span class="nav-icon" aria-hidden="true">${icon(id)}</span><span>${label}</span>${id==='learn'?`<span class="nav-count">${DATA.length}</span>`:''}</button>`).join('');
 $('app').setAttribute('data-mode',tab==='daily'?'speak':tab);
 const views={daily:dailyView,home:homeView,learn:learnView,speak:speakView,quiz:quizView,role:roleView,progress:progressView};
 $('app').innerHTML=(storageIssue?`<div class="notice" role="alert">${esc(storageIssue)}</div>`:'')+views[tab]();
 if(tab==='speak'||tab==='daily')updateVoiceInfo();
}

function homeView(){const s=stats();return `<div class="home-top"><span class="eyebrow">YOUR AUSTRALIAN ADVENTURE</span><span class="pill">🇦🇺 ${DATA.length} PHRASES</span></div><section class="hero"><div class="hero-copy"><span class="hero-label">READY FOR TAKE-OFF</span><h1>G’day,<br><em>Australia.</em></h1><p>聞く。話す。旅に出る。</p><span class="hero-menu-hint">メニューから学習を選ぼう</span></div><div class="hero-art"><img src="assets/australia.svg" width="560" height="400" alt="オーストラリアの地図、シドニーのオペラハウスと海"></div><span class="hero-coordinate" aria-hidden="true">33°51′S 151°12′E · SYDNEY</span></section>${dailyHome()}<div class="section-title"><h2>マイトリップ</h2><span>${Math.round(s.done/DATA.length*100)}% READY</span></div>${statsHtml()}<div class="journey-line"><div class="progress-bar"><span style="width:${s.done/DATA.length*100}%"></span></div><div class="badge-row">${achievements(s)}</div></div>${progressView()}`;}
function dailyHome(){
 const plan=C.dailyPlan(DATA,state,today()),n=plan.completed.length,complete=n===plan.ids.length;
 return `<section class="daily-home"><div class="daily-home-copy"><span class="eyebrow">DAILY FIVE</span><h2>今日の5分コース</h2><p>苦手・未学習から、今日の5フレーズ。</p><span class="daily-count">${n} / ${plan.ids.length} 完了 · 時間は目安</span></div><div class="daily-home-action">${button('daily-start',complete?'今日の成果を見る':n?'つづきから':'5フレーズに挑戦','primary')}${sceneArt(4)}</div></section>`;
}
function startDaily(repeat=false){
 state.daily=C.dailyPlan(DATA,state,today());if(repeat)state.daily.completed=[];save();go('daily');
}
function dailyPhrase(){
 const plan=state.daily;return DATA.find(p=>p.id===plan?.ids.find(id=>!plan.completed.includes(id)));
}
function dailyView(){
 if(!state.daily||state.daily.date!==today()){state.daily=C.dailyPlan(DATA,state,today());save();}
 const plan=state.daily,p=dailyPhrase(),n=plan.completed.length;
 if(!p)return pageHead('DAILY FIVE','今日の5分コース','')+`<section class="panel daily-complete"><span class="daily-trophy" aria-hidden="true">✦</span><h2>Good on ya!</h2><p>今日の5フレーズ、完了！</p><div class="daily-summary">${plan.ids.map(id=>{const x=DATA.find(p=>p.id===id);return `<div><strong lang="en">${esc(x.en)}</strong><span>${esc(x.ja)}</span></div>`;}).join('')}</div><div class="actions">${button('daily-home','ホームへ','primary')}${button('daily-repeat','もう一度')}</div></section>`;
 selected=p.id;
 return pageHead('DAILY FIVE','今日の5分コース','')+`<div class="daily-step"><span>${n+1} / ${plan.ids.length}</span><span>聞いて、声に出そう</span>${button('daily-home','あとで続ける')}</div><div class="progress-bar daily-progress"><span style="width:${n/plan.ids.length*100}%"></span></div><section class="panel phrase-card daily-lesson"><span class="tag">${esc(p.category)}</span><p class="phrase" lang="en">${esc(p.en)}</p><p class="translation">${esc(p.ja)}</p><div class="actions">${button('speak-phrase',icon('play')+' お手本')}</div>${speechControls('daily-recognize')}<div id="status" class="status" role="status"></div><details><summary>音声入力を使わず進める</summary><p>声に出してお手本と聞き比べ、確認できたら完了にできます。音声一致による判定とは別です。</p>${button('daily-self','自己確認で完了')}</details>${voiceHelp()}</section>`;
}
function finishDaily(id,fromSpeech){
 if(tab!=='daily'||dailyPhrase()?.id!==id)return;
 state.daily.completed.push(id);state.done[id]=true;activity(id);
 const advance=()=>{if(tab!=='daily')return;render();if(!dailyPhrase())feedback.celebrate();};
 if(fromSpeech)showResult(true,advance);else{toast('自己確認を記録しました。');advance();}
}
function checkDaily(text,id){
 if(tab!=='daily'||dailyPhrase()?.id!==id)return;
 if(!text.trim()){status('声が認識されませんでした。もう一度試そう。');return;}
 const p=DATA.find(p=>p.id===id);$('status').innerHTML=diffHtml(p.en,text);
 if(C.spokenCheck(p.en,text,'en').score>=GOOD_THRESHOLD)finishDaily(id,true);else showResult(false);
}
function sceneArt(index){return `<svg class="scene-art" viewBox="0 0 200 112" aria-hidden="true" focusable="false"><use href="assets/scenes.svg#scene-${index}"/></svg>`;}
function dialogueJa(text){return window.DIALOGUE_JA?.[text]||'';}
function translatedLine(text){return `<small class="dialogue-ja" lang="ja">${esc(dialogueJa(text))}</small>`;}
function achievements(s){return [[s.done>=1,'✦ はじめの一歩'],[s.done>=5,'✦ 5フレーズ達成'],[s.done>=30,'✦ 旅じたく名人'],[s.total>=10,'✦ 10問チャレンジ']].map(([earned,label])=>`<span class="achievement ${earned?'earned':''}">${label}${earned?' ✓':''}</span>`).join('');}
function learnView(){if(stages.learn==='situations')return situationView();const list=filtered();if(list.length&&!list.some(p=>p.id===selected))selected=list[0].id;const p=current(),at=list.findIndex(x=>x.id===p.id);return pageHead('PHRASE LIBRARY','フレーズ学習','ひとことから会話例まで。使う場面をイメージしよう。')+`<div class="situation-back">${button('situations-back','← シチュエーションを選び直す')}</div><div class="toolbar"><label class="check"><input id="only-star" type="checkbox" ${onlyStar?'checked':''}>苦手だけ表示</label></div><div id="learn-content">${learnContent(list,p,at)}</div>`;}
function situationView(){
 const scenes=[['あいさつ','MEET & GREET','role'],['リアクション・フィラー','REACT & CONNECT','role'],['聞き返す・断る・感謝する','ASK & THANK','quiz'],['カフェ','AT THE CAFÉ','play'],['空港・機内','AT THE AIRPORT','arrow'],['観光','EXPLORE AUSTRALIA','home'],['オーストラリアスラング','SPEAK LIKE A LOCAL','speak'],['ホームステイ','AT HOME','home'],['学校・授業での交流','SCHOOL EXCHANGE','role'],['科学研修・施設見学','SCIENCE & DISCOVERY','quiz'],['バス・電車での移動','GETTING AROUND','arrow'],['体調・困ったとき','ASK FOR HELP','role']];
 return pageHead(({learn:'01',speak:'02',quiz:'03',role:'04'}[tab]||'01')+' / SITUATIONS','どこで話す？','')+`<p class="scene-intro">${{learn:'フレーズ学習',speak:'発音練習',quiz:'暗記チェック',role:'会話練習'}[tab]}のシチュエーションを選ぼう</p><div class="situation-grid">${scenes.map(([name,tag,glyph],i)=>{const list=DATA.filter(p=>p.category===name),done=list.filter(p=>state.done[p.id]).length;return `<button type="button" class="situation-card scene-${i}" data-action="situation-select" data-value="${esc(name)}">${sceneArt(i)}<span class="eyebrow">${tag}</span><strong>${esc(name)}</strong><span class="scene-count">${list.length} フレーズ <span>${done} / ${list.length} 学習済み</span></span><span class="scene-arrow">↗</span></button>`;}).join('')}</div><div class="actions">${button('situation-select','すべてのフレーズ','','data-value="すべて"')}${tab==='learn'?button('review-star','★ 苦手を復習'):''}</div>`;
}

function learnContent(list,p,at){if(!list.length)return `<div class="panel empty">見つかりませんでした。<div class="actions" style="justify-content:center">${button('clear-filter','絞り込みを解除')}</div></div>`;return `<section class="panel phrase-card"><div class="row spread"><div class="row"><span class="tag">${esc(p.category)}</span><span class="small muted">No. ${p.id.toString().padStart(3,'0')}</span></div><span class="small muted">${at+1} / ${list.length}</span></div><div class="row" style="margin-top:18px">${button('toggle-en',showEn?'EN 表示中':'EN 非表示','','aria-pressed="'+!showEn+'"')}${button('toggle-ja',showJa?'JP 表示中':'JP 非表示','','aria-pressed="'+!showJa+'"')}</div><p class="phrase" lang="en">${showEn?esc(p.en):'••• 英文を非表示 •••'}</p><p class="translation">${showJa?esc(p.ja):'日本語訳を非表示'}</p><div class="actions">${button('speak-phrase',icon('play')+' お手本','primary')}${button('star',state.star[p.id]?'★ 苦手':'☆ 苦手','','aria-pressed="'+!!state.star[p.id]+'"')}${button('done',state.done[p.id]?'✓ 学習済み':'覚えた！','soft','aria-pressed="'+!!state.done[p.id]+'"')}</div><div class="row phrase-nav spread">${button('prev','← 前へ')}<span class="small muted">${state.attempts[p.id]||0} 回学習</span>${button('next','次へ →')}</div><details><summary>会話例</summary><div class="dialogue">${p.dialogue.map((d,i)=>`<div class="bubble"><span class="role">${esc(d.role)}</span>${button('dialogue-audio','♬','icon',`data-index="${i}" aria-label="${esc(d.role)}のセリフを再生"`)}<span lang="en">${showEn?esc(d.text):'英文を非表示'}</span>${showJa?translatedLine(d.text):''}</div>`).join('')}</div></details></section><div class="section-title"><h2>フレーズ一覧</h2><span>${list.length} フレーズ</span></div><div class="list" aria-label="フレーズ一覧">${list.map(x=>phraseItem(x)).join('')}</div>`;}
function phraseItem(p){return `<button type="button" class="list-item ${p.id===selected?'selected':''}" data-action="select" data-id="${p.id}" ${p.id===selected?'aria-current="true"':''}><span class="number">${String(p.id).padStart(3,'0')}</span><span class="copy"><strong lang="en">${showEn?esc(p.en):'英文を非表示'}</strong><small>${showJa?esc(p.ja):'日本語訳を非表示'}</small></span><span aria-label="${state.star[p.id]?'苦手':''}">${state.star[p.id]?'★':''}</span><span aria-label="${state.done[p.id]?'学習済み':''}">${state.done[p.id]?'✓':'→'}</span></button>`;}
function move(n){cleanupMedia();const list=tab==='learn'?filtered():tab==='speak'?scenePool(speakCategory):DATA;if(!list.length)return;selected=list[(list.findIndex(p=>p.id===selected)+n+list.length)%list.length].id;render();}
function toggleDone(){const p=current();state.done[p.id]=!state.done[p.id];if(state.done[p.id]){activity(p.id);toast('いい調子！ 学習済みにしました。');}else save();render();}
function toggleStar(){state.star[selected]=!state.star[selected];save();render();}
function speak(text,rate=.9,onEnd=null,onError=null){if(!window.speechSynthesis||!window.SpeechSynthesisUtterance){const message='このブラウザではお手本音声を再生できません。';toast(message);onError?.(message);return false;}stopRecognition();speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang='en-AU';u.rate=rate;const voices=speechSynthesis.getVoices(),voice=voices.find(v=>v.lang.toLowerCase().replace('_','-')==='en-au')||voices.find(v=>/^en[-_]/i.test(v.lang));if(voice)u.voice=voice;u.onend=()=>onEnd?.();u.onerror=e=>{if(!['canceled','interrupted'].includes(e.error)){const message='音声を再生できませんでした。端末の音声設定を確認してください。';toast(message);onError?.(message);}};speechSynthesis.speak(u);return true;}
function updateVoiceInfo(){if(!$('voice-info'))return;const vs=window.speechSynthesis?.getVoices()||[],v=vs.find(v=>/^en[-_]au$/i.test(v.lang))||vs.find(v=>/^en[-_]/i.test(v.lang));$('voice-info').textContent=v?`お手本：${v.name} (${v.lang})${/^en[-_]au$/i.test(v.lang)?'':' · オーストラリア英語がないため代替の英語音声'}`:'お手本：端末の利用可能な英語音声を使用します。音声がない場合はOSに英語音声を追加してください。';}
function speakView(){if(stages.speak==='situations')return situationView();const p=current(),pool=scenePool(speakCategory);return pageHead('02 / SPEAK','発音練習','')+situationBack()+`<section class="panel phrase-card"><div class="row spread"><span class="tag">${esc(p.category)} · ${pool.findIndex(x=>x.id===p.id)+1} / ${pool.length}</span><div class="row">${button('prev','←','icon','aria-label="前のフレーズ"')}${button('next','→','icon','aria-label="次のフレーズ"')}</div></div><p class="phrase" lang="en">${esc(p.en)}</p><p class="translation">${esc(p.ja)}</p><div class="actions">${button('speak-phrase',icon('play')+' お手本')}</div><div class="practice-input">${speechControls('recognize')}</div><div id="status" class="status" role="status"></div><details><summary>手入力で確認</summary><label class="field">英文<textarea id="speech-input" lang="en" placeholder="英文を入力" maxlength="3000"></textarea></label><div class="actions">${button('compare','照合する')}</div></details>${voiceHelp()}</section>`;}
function diffHtml(text,actual){const result=C.spokenCheck(text,actual,'en');const chips=(items,kind)=>items.map(w=>`<span class="word ${w.match?'match':kind}" aria-label="${w.match?'一致':'相違'}: ${esc(w.text)}">${w.match?'✓':'△'} ${esc(w.text)}</span>`).join(' ');return `<div class="row spread"><strong>単語一致度</strong><span class="score">${result.score}%</span></div><p class="small muted">発音の点数ではありません。</p><div class="small muted">お手本</div><div lang="en">${chips(result.expected,'miss')}</div><div class="small muted" style="margin-top:12px">認識・入力結果</div><div lang="en">${chips(result.actual,'extra')||'—'}</div><details><summary>色・照合について</summary><p class="legend">短縮形と選択表現を正規化して表示。<br>✓ 一致 ／ △ オレンジ：欠落 ／ △ 赤：異なる単語<br>語順も比較します。言い換えや認識ミスで低くなる場合があります。</p></details>`;}
function voiceHelp(){return `<p class="voice-disclosure">音声認識はブラウザ提供元へ送信される場合があります。</p><details><summary>音声入力で困ったら</summary><p class="small muted">Chrome・Edge・Safariでこのサイトを直接開き、サイト設定でマイクを許可してください。「話してください」の表示後に話すと、話し終わりを検出して自動で照合します。アプリ内ブラウザや学校のネットワークでは利用できない場合があります。</p><p class="small muted">○／× は認識結果とお手本の一致を示します。発音の点数ではありません。</p><p class="tip" id="voice-info"></p></details>`;}
function speechControls(action,label='話してチェック'){
 return `<div class="speech-controls" data-state="idle"><button type="button" data-action="${action}" id="recognize-start" class="primary mic-button" ${speech.supported()?'':'disabled'}>${icon('speak')} ${label}</button><p id="speech-state" class="speech-state" role="status">${speech.supported()?'マイクを押してスタート':'音声認識に非対応。Chrome・Edge・Safariで直接開いてください。'}</p><p id="speech-transcript" class="speech-transcript" aria-live="polite"></p></div>`;
}
function updateSpeechState({phase,message,text=''}){
 speechPhase=phase;
 const busy=['starting','listening','stopping'].includes(phase);
 if($('recognize-start')){$('recognize-start').disabled=busy||!speech.supported();$('recognize-start').setAttribute('aria-busy',String(busy));}
 if($('speech-state')){$('speech-state').textContent=message;$('speech-state').setAttribute('data-phase',phase);}
 if($('speech-transcript'))$('speech-transcript').textContent=text;
}
function recognize(callback,lang='en-AU',expected=''){
 feedback.cancel();feedback.prime();window.speechSynthesis?.cancel();
 return speech.start({lang,expected,onResult:callback});
}
function compareSpeech(text,fromSpeech=false){if(!text.trim()){status('声が認識されませんでした。もう一度試そう。');return;}$('status').innerHTML=diffHtml(current().en,text);activity(current().id);if(fromSpeech){const correct=C.spokenCheck(current().en,text,'en').score>=GOOD_THRESHOLD;showResult(correct,correct?()=>move(1):null);}}
function newQuiz(exclude=null){const ordered=C.reviewOrder(scenePool(quizCategory),state,'en');quizId=(ordered.find(p=>p.id!==exclude)||ordered[0]).id;quizRevealed=false;quizGraded=false;quizText='';quizFeedback='';quizSource='';}
function quizView(){if(stages.quiz==='situations')return situationView();if(!quizId)newQuiz();const p=DATA.find(p=>p.id===quizId),q=state.quiz[`${p.id}:en`];return pageHead('03 / RECALL','暗記チェック','')+situationBack()+`<section class="panel phrase-card quiz-card"><div class="row spread"><span class="tag">${esc(p.category)} · No. ${p.id}</span><span class="small muted">${q?.lastWrong?'↻ 前回の復習':state.star[p.id]?'★ 苦手':''}</span></div><h2 class="quiz-prompt">英語で言ってみよう</h2><p class="phrase">${esc(p.ja)}</p>${!quizGraded?speechControls('quiz-recognize',quizText?'もう一度話す':'話して答える'):''}<div id="status" class="status" role="status">${quizText?`<span class="small muted">認識結果</span><p lang="en">${esc(quizText)}</p>${quizSource==='speech'?`単語一致度 ${C.spokenCheck(p.en,quizText,'en').score}%`:''}`:''}</div>${!quizRevealed?`<div class="actions">${button('quiz-reveal','解答を見る')}</div>`:`<div class="quiz-result"><span class="small muted">解答例</span><p class="phrase" lang="en">${esc(p.en)}</p>${button('quiz-audio',icon('play')+' お手本')}${quizText?`<details><summary>単語の照合結果</summary>${diffHtml(p.en,quizText)}</details>`:''}${quizGraded?`<p class="tip" role="status">${esc(quizFeedback)}</p><div class="actions">${button('quiz-next','次へ '+icon('arrow'),'primary')}</div>`:`<p class="tip">${quizText?'認識ミスや言い換えは、自分でも確認できます。':'声に出せたか、確認しよう。'}</p><div class="result-actions">${button('quiz-correct','✓ 言えた','primary')}${button('quiz-wrong','↻ 復習する')}</div>`}</div>`}<p class="quiz-disclaimer">○／× は英文一致の目安。発音の採点ではありません。</p></section>${voiceHelp()}`;}
function checkQuizSpeech(text){
 if(!text.trim()){status('声が認識されませんでした。もう一度試そう。');return;}
 quizText=text;quizSource='speech';quizRevealed=true;
 const p=DATA.find(p=>p.id===quizId),result=C.spokenCheck(p.en,text,'en');
 if(result.score>=GOOD_THRESHOLD){gradeQuiz(true,'speech');}else{render();showResult(false);}
}
function gradeQuiz(correct,source='self'){if(quizGraded||!quizRevealed)return;const key=`${quizId}:en`,q=state.quiz[key]||{total:0,correct:0,misses:0};q.total++;q.correct+=correct?1:0;q.misses+=correct?0:1;q.lastWrong=!correct;q.last=new Date().toISOString();state.quiz[key]=q;if(!correct)state.star[quizId]=true;activity(quizId);quizGraded=true;quizFeedback=correct?(source==='speech'?'認識結果が一致。クリア！':'自己確認でクリア！'):'復習リストに追加しました。';render();if(correct&&source==='speech')showResult(true,()=>{const old=quizId;newQuiz(old);render();});else if(correct)toast('自己確認クリア！ その調子！');}
function resetRole(){conversationState={phase:'idle',running:false,message:''};conversationLast=null;roleTurn=0;roleLog=[];roleStarted=false;roleCounted=false;}
function rolePhrase(){return DATA.find(p=>p.id===roleId)||DATA[0];}
function roleView(){if(stages.role==='situations')return situationView();return pageHead('04 / CONVERSATION','会話練習','')+situationBack()+`<div class="tab-switch">${button('role-textbook','教材の会話',roleMode==='textbook'?'primary':'','aria-pressed="'+(roleMode==='textbook')+'"')}${availableBranches().length?button('role-branch','Extra Practice',roleMode==='branch'?'primary':'','aria-pressed="'+(roleMode==='branch')+'"'):''}</div>${roleMode==='textbook'?textbookView():branchView()}<p class="tip">教材・選択式シナリオで練習</p>`;}
function textbookView(){const p=rolePhrase(),roles=[...new Set(p.dialogue.map(d=>d.role))];return `<section class="panel conversation-lesson" data-phrase-id="${p.id}"><div class="conversation-target"><div class="row spread"><span class="tag">${esc(p.category)}</span><span class="small muted">No. ${p.id}</span></div><span class="target-label">練習フレーズ</span><h2 class="practice-target" lang="en">${esc(p.en)}</h2><p class="practice-meaning">${esc(p.ja)}</p></div><div class="conversation-options"><label class="field">あなたの役<select id="my-role" ${conversationState.running?'disabled':''}>${options(roles,myRole)}</select></label><span class="small muted">${Math.min(roleTurn+1,p.dialogue.length)} / ${p.dialogue.length}</span>${button('role-reset','↻ 最初から')}</div>${conversationState.phase!=='complete'?conversationControls():''}<div class="dialogue full-script" aria-label="会話の全文">${p.dialogue.map((d,i)=>`<div class="bubble ${d.role===myRole?'mine':'partner'} ${i===roleTurn?'current-turn':''} ${i<roleTurn?'completed-turn':''}" ${i===roleTurn?'aria-current="step"':''}><span class="role">${d.role===myRole?'YOU':'PARTNER'} · ${esc(d.role)} ${i<roleTurn?'✓':''}${i===roleTurn?' · 今ここ':''}</span>${conversationState.running?'':button('role-line-audio',icon('play'),'icon',`data-index="${i}" aria-label="${esc(d.role)}のセリフを聞く"`)}<span lang="en">${esc(d.text)}</span>${translatedLine(d.text)}${roleLog[i]?.text&&roleLog[i].text!==d.text?`<small class="recognized-line">認識：${esc(roleLog[i].text)}</small>`:''}</div>`).join('')}</div>${conversationState.phase==='complete'?conversationControls():''}<div id="status" class="status" role="status">${conversationLast?diffHtml(conversationLast.expected,conversationLast.text):''}</div></section><p class="voice-disclosure">音声認識はブラウザ提供元へ送信される場合があります。</p>`;}

function branch(){return window.BRANCHES.find(b=>b.id===branchId);}
function resetBranch(){cleanupMedia();conversationState={phase:'idle',running:false,message:''};conversationLast=null;branchNode=branch().start;branchLog=[];branchHeard=false;branchCounted=false;}
function branchView(){const b=branch(),node=b.nodes[branchNode];return `<section class="panel"><div class="conversation-target"><span class="target-label">Extra Practice</span><h2 class="practice-target">${esc(b.title)}</h2></div><div class="row spread"><span class="tag">分岐シナリオ</span>${button('branch-reset','最初から')}</div>${conversationState.phase!=='complete'?conversationControls():''}<div class="dialogue">${branchLog.map(l=>`<div class="bubble ${l.mine?'mine':'partner'}"><span class="role">${l.mine?'あなた':'相手'}</span><span lang="en">${esc(l.text)}</span><small class="dialogue-ja" lang="ja">${esc(l.ja||dialogueJa(l.text))}</small></div>`).join('')}<div class="bubble partner"><span class="role">相手</span><span lang="en">${esc(node.partner)}</span>${translatedLine(node.partner)}</div></div>${node.options.length?`<h3 style="margin-top:25px">返答を選んで話そう</h3><div class="branch-responses">${node.options.map(o=>`<div class="branch-response"><span lang="en">${esc(o.en)}</span><small class="dialogue-ja" lang="ja">${esc(dialogueJa(o.en)||o.ja)}</small></div>`).join('')}</div>`:''}${conversationState.phase==='complete'?conversationControls():''}<div id="status" class="status" role="status">${conversationLast?diffHtml(conversationLast.expected,conversationLast.text):''}</div>${voiceHelp()}</section>`;}

function progressView(){const s=stats(),starred=DATA.filter(p=>state.star[p.id]);return `<section class="panel"><h2>学びの足あと</h2><p class="small muted">${state.sessions} 回の学習セッション · ${Object.keys(state.days).filter(k=>state.days[k]>0).length} 日学習 · 暗記チェック ${s.correct} / ${s.total} 問正解</p><details><summary>記録の見方</summary><p class="small muted">学習回数は学習操作の合計。正答率は音声照合と自己確認の結果で、発音の点数ではありません。</p></details><div class="badge-row">${achievements(s)}</div><h3 style="margin-top:26px">カテゴリー別の進み具合</h3><div class="category-grid">${categories().slice(1).map(c=>{const list=DATA.filter(p=>p.category===c),n=list.filter(p=>state.done[p.id]).length;return `<div class="category"><div class="row"><span>${esc(c)}</span><span class="muted">${n} / ${list.length}</span></div><div class="progress-bar"><span style="width:${n/list.length*100}%"></span></div></div>`;}).join('')}</div></section><section class="panel"><div class="row spread"><h2>苦手フレーズ</h2><span class="pill">${s.star} 件</span></div><p class="small muted">★で登録・解除</p>${starred.length?`<div class="list">${starred.map(p=>phraseItem(p)).join('')}</div><div class="actions">${button('review-star','苦手だけ学習する →','primary')}</div>`:'<p class="empty">苦手フレーズはありません。</p>'}</section><section class="panel"><h2>記録のバックアップ</h2><p class="small muted">記録はこのブラウザに保存。JSONで別の端末へ移せます。</p><div class="actions">${button('export','JSONで保存')}${button('import','バックアップを復元')}<input class="visually-hidden" id="import-file" type="file" accept=".json,application/json" aria-label="学習記録JSONファイル"></div><p class="tip">復元すると現在の記録を置き換えます。</p><details><summary>音声機能・プライバシーについて</summary><p class="small muted">お手本音声はOS・ブラウザの音声合成を利用します。en-AUを優先し、利用できない場合は別の英語音声へ切り替えます。音声認識はブラウザの対応・権限・ネットワークに依存し、サービス提供元への送信が行われる場合があります。録音・保存機能はありません。音声認識に非対応の環境では、解答の自己確認や手入力で学習できます。</p></details></section>`;}
function stopRecognition(){speech.cancel();}
function cleanupMedia(){conversation.cancel();conversationState={phase:'idle',running:false,message:''};conversationLast=null;}
function exportState(){const url=URL.createObjectURL(new Blob([JSON.stringify({app:'aussie-english-trainer',...state},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`aussie-progress-${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('学習記録のバックアップを保存しました。');}
async function importState(file){if(!file)return;try{if(file.size>2*1024*1024)throw Error('ファイルが大きすぎます（上限2MB）');const raw=JSON.parse(await file.text());if(!raw||typeof raw.done!=='object'||typeof raw.star!=='object'||!raw.done||!raw.star||Array.isArray(raw.done)||Array.isArray(raw.star))throw Error('Aussie English Trainerのバックアップを選んでください');const next=C.cleanState(raw,DATA);if(!confirm('現在の学習記録をバックアップの内容で置き換えます。復元しますか？'))return;state=next;activityStarted=false;quizId=null;save();render();toast('学習記録を復元しました。');}catch(e){toast('復元できませんでした：'+e.message);}}
document.addEventListener('click',event=>{const el=event.target.closest('[data-action]');if(!el||el.disabled)return;const a=el.dataset.action;
 switch(a){
 case 'tab':go(el.dataset.value);break;
 case 'situation-select':{
  const value=el.dataset.value;if(!(tab in stages)||!categories().includes(value))break;
  cleanupMedia();stages[tab]='phrases';const first=scenePool(value)[0];
  if(tab==='learn'){category=value;search='';onlyStar=false;selected=first.id;}
  if(tab==='speak'){speakCategory=value;selected=first.id;}
  if(tab==='quiz'){quizCategory=value;newQuiz();}
  if(tab==='role'){roleCategory=value;roleId=first.id;roleMode='textbook';resetRole();const choices=availableBranches();if(choices.length)branchId=choices[0].id;resetBranch();}
  render();window.scrollTo({top:0,behavior:'instant'});break;
 }
 case 'daily-start':startDaily();break;
 case 'daily-home':go('home');break;
 case 'daily-repeat':startDaily(true);break;
 case 'daily-recognize':{const p=dailyPhrase();if(p)recognize(text=>checkDaily(text,p.id),'en-AU',p.en);break;}
 case 'daily-self':{const p=dailyPhrase();cleanupMedia();if(p)finishDaily(p.id,false);break;}
 case 'situations-back':cleanupMedia();if(tab in stages)stages[tab]='situations';render();break;
 case 'select':if(ids.has(el.dataset.id)){selected=Number(el.dataset.id);if(tab==='home'){search='';category='すべて';onlyStar=false;go('learn');stages.learn='phrases';render();}else{cleanupMedia();render();}window.scrollTo({top:0,behavior:'instant'});}break;
 case 'clear-filter':search='';category='すべて';onlyStar=false;render();break;
 case 'prev':move(-1);break;case 'next':move(1);break;
 case 'toggle-en':showEn=!showEn;render();break;case 'toggle-ja':showJa=!showJa;render();break;
 case 'star':toggleStar();break;case 'done':toggleDone();break;
 case 'speak-phrase':speak(current().en);activity(current().id);break;
 case 'dialogue-audio':speak(current().dialogue[Number(el.dataset.index)].text);activity(current().id);break;
 case 'recognize':recognize(text=>{if($('speech-input'))$('speech-input').value=text;compareSpeech(text,true);},'en-AU',current().en);break;
 case 'compare':compareSpeech($('speech-input').value);break;
 case 'quiz-reveal':stopRecognition();quizRevealed=true;render();break;
 case 'quiz-recognize':{if(quizGraded)break;const id=quizId;recognize(text=>{if(quizId===id&&!quizGraded)checkQuizSpeech(text);},'en-AU',DATA.find(p=>p.id===id).en);break;}
 case 'quiz-correct':gradeQuiz(true);break;case 'quiz-wrong':gradeQuiz(false);break;
 case 'quiz-next':{cleanupMedia();const old=quizId;newQuiz(old);render();break;}
 case 'quiz-audio':speak(DATA.find(p=>p.id===quizId).en);break;
 case 'role-textbook':cleanupMedia();roleMode='textbook';resetRole();render();break;
 case 'role-branch':{const choices=availableBranches();if(!choices.length)break;cleanupMedia();if(!choices.some(b=>b.id===branchId))branchId=choices[0].id;roleMode='branch';resetBranch();render();break;}
 case 'role-reset':cleanupMedia();resetRole();render();break;
 case 'role-line-audio':speak(rolePhrase().dialogue[Number(el.dataset.index)]?.text||'');break;
 case 'conversation-start':startConversation();break;
 case 'conversation-next':nextConversation();break;
 case 'conversation-pause':conversation.pause();break;
 case 'conversation-restart':cleanupMedia();if(roleMode==='textbook')resetRole();else resetBranch();startConversation();break;
 case 'branch-reset':resetBranch();render();break;
 case 'review-star':go('learn');onlyStar=true;search='';category='すべて';stages.learn='phrases';render();break;
 case 'export':exportState();break;case 'import':$('import-file').click();break;
 }
});

document.addEventListener('change',event=>{const v=event.target.value;switch(event.target.id){
 case 'only-star':onlyStar=event.target.checked;cleanupMedia();render();break;
 case 'my-role':cleanupMedia();myRole=v;resetRole();render();break;
 case 'import-file':importState(event.target.files[0]);break;
}});
window.addEventListener('pagehide',cleanupMedia);
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(conversation.isRunning())conversation.pause('画面を離れたため一時停止しました。再開で続けられます。');else cleanupMedia();}});
window.addEventListener('hashchange',()=>go(location.hash.slice(1)));
if(window.speechSynthesis)window.speechSynthesis.addEventListener('voiceschanged',updateVoiceInfo);
if(DATA.length>=129&&new Set(DATA.map(p=>p.id)).size===DATA.length) {const requested=location.hash.slice(1);if(requested==='progress')tab='home';else if(requested==='daily')tab='daily';else if(navItems.some(x=>x[0]===requested))tab=requested;render();}else $('app').innerHTML='<div class="notice" role="alert">教材を読み込めません。index.htmlとphrases.jsなどのファイルを同じフォルダに配置してください。</div>';
})();
