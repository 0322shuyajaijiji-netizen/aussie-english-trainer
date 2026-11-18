/* 会話の一回スタート進行。音声終了→聞き取り→一致→次の番を順に制御。 */
(function(root){
'use strict';
function create({getTurn,play,listen,judge,feedback,advance,complete,onState=()=>{},halt=()=>{}}){
 let running=false,generation=0,phase='idle',timer=null;
 function clear(){root.clearTimeout(timer);timer=null;}
 function emit(next,message=''){phase=next;onState({phase:next,running,message});}
 function pause(message='一時停止しました。再開で続きから練習できます。'){
  generation++;running=false;clear();halt();emit('paused',message);
 }
 function cancel(){generation++;running=false;clear();halt();phase='idle';}
 function step(id){
  if(id!==generation||!running)return;
  const turn=getTurn();
  if(!turn){running=false;clear();halt();emit('complete');complete();return;}
  const live=()=>id===generation&&running;
  const fail=message=>{if(live())pause(message);};
  if(turn.kind==='partner'){
   emit('partner','相手のセリフを聞こう');
   let ended=false;
   const done=()=>{
    if(!live()||ended)return;ended=true;clear();advance(turn);
    // スピーカーの余韻をマイクが拾わないよう短い間隔を空ける。
    timer=root.setTimeout(()=>step(id),300);
   };
   timer=root.setTimeout(()=>fail('相手の音声を再生できませんでした。音声設定を確認し、再開してください。'),45000);
   try{play(turn.text,done,fail);}catch{fail('相手の音声を再生できません。ブラウザの音声設定を確認してください。');}
  }else{
   emit('user','あなたの番。話してください');
   let answered=false;
   const result=text=>{
    if(!live()||answered)return;answered=true;
    const decision=judge(turn,text);
    emit('checking',decision.correct?'一致！ 次の番へ':'もう一度話してみよう');
    let continued=false;
    feedback(decision.correct,()=>{
     if(!live()||continued)return;continued=true;
     if(decision.correct)advance(turn,{...decision,text});
     step(id);
    });
   };
   try{const started=listen(turn.expected,result,fail);if(started===false&&live())fail('マイクを開始できません。ブラウザのマイク許可を確認して再開してください。');}
   catch{fail('マイクを開始できません。設定を確認して再開してください。');}
  }
 }
 function start(){if(running)return false;running=true;const id=++generation;clear();step(id);return true;}
 return {start,pause,cancel,isRunning:()=>running,getPhase:()=>phase};
}
root.AussieConversation={create};
})(typeof window==='undefined'?globalThis:window);
