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
 function sound(correct){
  if(!context||context.state==='suspended'||context.state==='closed')return;
  try{const now=context.currentTime;
   (correct?[660,880]:[200,150]).forEach((hz,i)=>{
    const oscillator=context.createOscillator(),gain=context.createGain();
    oscillator.type=correct?'sine':'triangle';oscillator.frequency.setValueAtTime(hz,now+i*.13);
    gain.gain.setValueAtTime(0,now+i*.13);gain.gain.linearRampToValueAtTime(.1,now+i*.13+.015);gain.gain.exponentialRampToValueAtTime(.001,now+i*.13+.18);
    oscillator.connect(gain);gain.connect(context.destination);oscillator.start(now+i*.13);oscillator.stop(now+i*.13+.2);
    oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
   });
  }catch{}
 }
 function cancel(){generation++;root.clearTimeout(timeout);timeout=null;hide();}
 function present(correct,onDone){
  cancel();const id=generation;show({correct,symbol:correct?'○':'×',label:correct?'一致！':'もう一度'});sound(correct);
  timeout=root.setTimeout(()=>{if(id!==generation)return;timeout=null;hide();if(onDone)onDone();},1100);
 }
 return {prime,present,cancel};
}
root.AussieFeedback={create};
})(typeof window==='undefined'?globalThis:window);
