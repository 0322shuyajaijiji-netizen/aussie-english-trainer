/* Web Audioで生成する無料の判定音。表示は非モーダルで自動消去。 */
(function(root){
'use strict';
function create({show=()=>{},hide=()=>{}}={}){
 let context=null, timeout=null, generation=0;
 function prime(){
  try{const AC=root.AudioContext||root.webkitAudioContext;if(!AC)return;
   context??=new AC();if(context.state==='suspended')context.resume()?.catch(()=>{});
  }catch{}
 }
 function melody(notes,{type='sine',spacing=.13,duration=.2}={}){
  if(!context||context.state==='suspended'||context.state==='closed')return;
  try{const now=context.currentTime;
   notes.forEach((hz,i)=>{
    const oscillator=context.createOscillator(),gain=context.createGain(),time=now+i*spacing;
    oscillator.type=type;oscillator.frequency.setValueAtTime(hz,time);
    gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(.1,time+.015);gain.gain.exponentialRampToValueAtTime(.001,time+duration-.02);
    oscillator.connect(gain);gain.connect(context.destination);oscillator.start(time);oscillator.stop(time+duration);
    oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
   });
  }catch{}
 }
 function sound(correct){melody(correct?[660,880]:[200,150],{type:correct?'sine':'triangle'});}
 function cancel(){generation++;root.clearTimeout(timeout);timeout=null;hide();}
 function present(correct,onDone,{label,kind='result'}={}){
  cancel();const id=generation;show({correct,symbol:correct?'○':'×',label:label||(correct?'一致！':'もう一度'),kind});sound(correct);
  timeout=root.setTimeout(()=>{if(id!==generation)return;timeout=null;hide();if(onDone)onDone();},1100);
 }
 function celebrate(){
  cancel();const id=generation;show({correct:true,symbol:'✦',label:'Good on ya!',kind:'complete'});
  melody([523.25,659.25,783.99,1046.5,783.99,1046.5,1318.51],{spacing:.13,duration:.33});
  timeout=root.setTimeout(()=>{if(id!==generation)return;timeout=null;hide();},2800);
 }
 return {prime,present,cancel,celebrate};
}
root.AussieFeedback={create};
})(typeof window==='undefined'?globalThis:window);
