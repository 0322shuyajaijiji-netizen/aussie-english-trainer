/* ブラウザ標準の音声認識。録音ファイル・外部APIは使用しません。 */
(function(root){
'use strict';
function create({onState=()=>{}}={}){
 let active=null, sequence=0, preferredEnglish='en-AU';
 const supported=()=>!!(root.SpeechRecognition||root.webkitSpeechRecognition)&&root.isSecureContext!==false;
 function emit(phase,message,text=''){onState({phase,message,text});}
 function clear(s){for(const timer of s.timers)root.clearTimeout(timer);s.timers=[];}
 function timer(s,fn,ms){const id=root.setTimeout(()=>{if(active===s)fn();},ms);s.timers.push(id);return id;}
 function detach(s){s.r.onstart=s.r.onresult=s.r.onerror=s.r.onend=s.r.onspeechend=null;}
 function release(s){clear(s);detach(s);if(active===s)active=null;}
 function best(s,results){
  let candidates=[''];
  for(let i=0;i<results.length;i++){
   const options=Array.from(results[i]).slice(0,5).map(x=>String(x.transcript||'').trim()).filter(Boolean);
   if(!options.length)continue;
   candidates=candidates.flatMap(prefix=>options.map(t=>(prefix+' '+t).trim())).slice(0,25);
  }
  const score=text=>s.expected&&root.AussieCore?root.AussieCore.spokenCheck(s.expected,text,s.lang.startsWith('ja')?'ja':'en').score:0;
  return candidates.reduce((a,b)=>score(b)>score(a)?b:a,candidates[0]||'');
 }
 function finish(s){
  if(active!==s)return;
  const text=s.allFinal?s.finalText:(s.interimText||s.finalText);
  release(s);
  // 既に確保した認識文字列は維持して、マイクだけを解放。
  try{s.r.abort();}catch{}
  if(text){emit('complete',s.finalText?'認識できました。':'取得した認識結果で確認しました。',text);s.onResult(text);}
  else emit('error','声を認識できませんでした。マイクを押し直して、表示が「話してください」になってから話そう。');
 }
 function cancel(){
  const s=active;if(!s)return;
  release(s);try{s.r.abort();}catch{}emit('idle','マイクを押してスタート');
 }
 function stop(){
  const s=active;if(!s||s.stopping)return;
  s.stopping=true;emit('stopping','認識結果を確認中…',s.interimText);
  // stop() は最終結果を待つ。abort() で発話結果を捨てない。
  try{s.r.stop();}catch{finish(s);return;}
  timer(s,()=>finish(s),1800);
 }
 function start({lang='en-AU',expected='',onResult=()=>{}}={}){
  if(active)return false;
  if(!supported()){emit('error',root.isSecureContext===false?'HTTPSで開いてください。':'このブラウザは音声認識に非対応です。Chrome・Edge・Safariで直接開いてください。');return false;}
  const SR=root.SpeechRecognition||root.webkitSpeechRecognition;
  let r;try{r=new SR();}catch{emit('error','音声入力を準備できません。ブラウザを開き直してください。');return false;}
  const s={id:++sequence,r,lang:lang.startsWith('en')?preferredEnglish:lang,expected,onResult,interimText:'',finalText:'',allFinal:false,timers:[],silenceTimer:null,stopping:false};
  active=s;r.lang=s.lang;r.continuous=false;r.interimResults=true;r.maxAlternatives=5;
  r.onstart=()=>{
   if(active!==s)return;clear(s);
   emit('listening','話してください',s.interimText);
   timer(s,stop,30000);
  };
  r.onresult=e=>{
   if(active!==s)return;
   s.interimText=best(s,e.results);
   root.clearTimeout(s.silenceTimer);
   if(s.interimText&&!s.stopping)s.silenceTimer=timer(s,stop,2000);
   const finals=Array.from(e.results).filter(result=>result.isFinal!==false);
   s.allFinal=finals.length===e.results.length;
   if(finals.length)s.finalText=best(s,finals);
   emit(s.stopping?'stopping':'listening',s.stopping?'認識結果を確認中…':'聞き取り中…',s.interimText);
   if(finals.length===e.results.length&&s.finalText){
    // onend が来ない実装にも対応。連続認識ではないため一発話で確定。
    timer(s,()=>finish(s),350);
   }
  };
  r.onspeechend=()=>{if(active===s)stop();};
  r.onend=()=>{if(active===s)finish(s);};
  r.onerror=e=>{
   if(active!==s)return;
   const code=e.error;release(s);try{r.abort();}catch{}
   if(code==='language-not-supported'&&s.lang==='en-AU'){
    preferredEnglish='en-US';emit('error','英語認識を代替音声へ切り替えました。もう一度マイクを押してください。');return;
   }
   const errors={
    'not-allowed':'マイクが許可されていません。ブラウザのサイト設定でマイクを許可し、もう一度押してください。',
    'service-not-allowed':'このブラウザでは認識サービスを利用できません。Chrome・Edge・Safariで直接開いてください。',
    'audio-capture':'マイクを利用できません。他の通話アプリを閉じ、マイク接続を確認してください。',
    'network':'音声認識サービスへ接続できません。通信を確認して再試行してください。学校のネットワークでは制限される場合があります。',
    'no-speech':'声を認識できませんでした。「話してください」の表示後に、マイクへ近づいて話そう。',
    'language-not-supported':'この言語の音声認識を利用できません。ブラウザの言語設定を確認してください。',
    'aborted':'音声入力を終了しました。もう一度マイクを押せます。'
   };
   emit('error',errors[code]||'音声入力を開始できません。ブラウザを開き直して再試行してください。');
  };
  emit('starting','マイクを準備中… 初回は使用を許可してください。');
  // 必ずクリックの同じ呼び出し内でstart。権限要求をawaitして操作権限を失わない。
  try{r.start();}catch{release(s);emit('error','マイクを開始できません。少し待ってから、もう一度押してください。');return false;}
  timer(s,()=>{release(s);try{r.abort();}catch{}emit('error','マイクの許可を確認してください。許可した後、もう一度押してください。');},45000);
  return true;
 }
 return {start,stop,cancel,supported,isActive:()=>!!active};
}
root.AussieSpeech={create};
})(typeof window==='undefined'?globalThis:window);
