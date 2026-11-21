/* UIに依存しない教材照合・復習順・保存データ検証。 */
(function (root) {
  'use strict';
  const words = text => String(text).normalize('NFKC').toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9'\s]/g, ' ').replace(/(^|\s)'|'(?=\s|$)/g, ' ').trim().split(/\s+/).filter(Boolean);
  function compare(expected, actual) {
    const a = words(expected), b = words(actual);
    const dp = Array.from({length:a.length + 1}, () => Array(b.length + 1).fill(0));
    for (let i=1;i<=a.length;i++) for(let j=1;j<=b.length;j++) dp[i][j] = a[i-1]===b[j-1] ? dp[i-1][j-1]+1 : Math.max(dp[i-1][j],dp[i][j-1]);
    const goodA=new Set(), goodB=new Set(); let i=a.length,j=b.length;
    while(i && j) { if(a[i-1]===b[j-1]) {goodA.add(--i);goodB.add(--j);} else if(dp[i-1][j]>=dp[i][j-1]) i--; else j--; }
    return {score:Math.round(200*goodA.size/Math.max(1,a.length+b.length)), expected:a.map((text,k)=>({text,match:goodA.has(k)})), actual:b.map((text,k)=>({text,match:goodB.has(k)}))};
  }
  const cleanNumber = n => Number.isSafeInteger(n) && n>=0 && n<=100000000 ? n : 0;
  function cleanState(raw, data) {
    if(!raw || typeof raw!=='object' || Array.isArray(raw)) throw Error('学習記録の形式が正しくありません');
    const s={version:2,done:{},star:{},attempts:{},quiz:{},days:{},sessions:cleanNumber(raw.sessions)};
    for(const p of data) {
      if(raw.done?.[p.id]===true) s.done[p.id]=true;
      if(raw.star?.[p.id]===true) s.star[p.id]=true;
      s.attempts[p.id]=cleanNumber(raw.attempts?.[p.id]);
      for(const dir of ['en','ja']) {
        const k=`${p.id}:${dir}`, q=raw.quiz?.[k];
        if(q && typeof q==='object') {const total=cleanNumber(q.total);s.quiz[k]={total,correct:Math.min(total,cleanNumber(q.correct)),misses:Math.min(total,cleanNumber(q.misses)),lastWrong:q.lastWrong===true,last:typeof q.last==='string'?q.last.slice(0,30):''};}
      }
    }
    if(raw.days && typeof raw.days==='object') for(const [day,n] of Object.entries(raw.days)) if(/^\d{4}-\d{2}-\d{2}$/.test(day)) s.days[day]=cleanNumber(n);
    const valid=new Set(data.map(p=>p.id)),daily=raw.daily;
    if(daily&&typeof daily==='object'&&/^\d{4}-\d{2}-\d{2}$/.test(daily.date)&&Array.isArray(daily.ids)){
      const ids=[...new Set(daily.ids.filter(id=>valid.has(id)))].slice(0,5);
      const completed=Array.isArray(daily.completed)?[...new Set(daily.completed.filter(id=>ids.includes(id)))]:[];
      if(ids.length===Math.min(5,data.length))s.daily={date:daily.date,ids,completed};
    }
    return s;
  }
  function dailyPlan(data,state,date){
    const valid=new Set(data.map(p=>p.id)),saved=state.daily;
    if(saved?.date===date&&saved.ids?.length===Math.min(5,data.length)&&new Set(saved.ids).size===saved.ids.length&&saved.ids.every(id=>valid.has(id))){
      return {date,ids:[...saved.ids],completed:[...new Set((saved.completed||[]).filter(id=>saved.ids.includes(id)))]};
    }
    const seed=[...date].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,0);
    const rank=p=>state.quiz[`${p.id}:en`]?.lastWrong?3:state.star[p.id]?2:!state.done[p.id]?1:0;
    const tie=p=>{let n=Math.imul(p.id^seed,0x45d9f3b);n=Math.imul(n^(n>>>16),0x45d9f3b);return (n^(n>>>16))>>>0;};
    const chosen=[...data].sort((a,b)=>rank(b)-rank(a)||(state.attempts[a.id]||0)-(state.attempts[b.id]||0)||tie(a)-tie(b)).slice(0,5);
    return {date,ids:chosen.map(p=>p.id),completed:[]};
  }
  function reviewOrder(data, state, dir) {
    return [...data].sort((a,b)=>{
      const qa=state.quiz[`${a.id}:${dir}`]||{}, qb=state.quiz[`${b.id}:${dir}`]||{};
      const rank=(p,q)=>(q.lastWrong?100:0)+(state.star[p.id]?30:0)+(!q.total?10:0)+Math.min(q.misses||0,20);
      return rank(b,qb)-rank(a,qa) || String(qa.last||'').localeCompare(String(qb.last||'')) || a.id-b.id;
    });
  }
  // 音声認識の表記差だけを吸収します。教材原文や発音品質は変更・採点しません。
  function spokenCheck(expected, actual, lang='en') {
    if(lang==='ja') {
      const normalize=s=>String(s).normalize('NFKC').replace(/[\s、。！？!?「」『』（）()・…,.]/g,'');
      const a=normalize(expected), b=normalize(actual);
      return {score:a&&b&&a===b?100:0};
    }
    const contractions={"i'm":"i am","it's":"it is","that's":"that is","how's":"how is","what's":"what is","we're":"we are","you're":"you are","they're":"they are","i'll":"i will","we'll":"we will","i've":"i have","we've":"we have","haven't":"have not","hasn't":"has not","don't":"do not","doesn't":"does not","didn't":"did not","can't":"cannot","isn't":"is not","aren't":"are not","let's":"let us","i'd":"i would","we'd":"we would"};
    const numberWords={zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19,twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90};
    const expand=s=>{
      const tokens=words(s).flatMap(w=>(contractions[w]||w).split(' ')),out=[];
      for(let i=0;i<tokens.length;i++){
        const n=numberWords[tokens[i]],next=numberWords[tokens[i+1]];
        if(n===undefined)out.push(tokens[i]);
        else if(n>=20&&next>=1&&next<=9){out.push(String(n+next));i++;}
        else out.push(String(n));
      }
      return out.join(' ');
    };
    let variants=String(expected).split(/\s*\/\s*/);
    variants=variants.flatMap(v=>{
      const m=v.match(/(\S+)\s*\(([^)]+)\)/);
      return m?[v.replace(m[0],m[1]),v.replace(m[0],m[2])]:[v];
    });
    const results=variants.map(v=>compare(expand(v),expand(actual)));
    return results.reduce((best,r)=>r.score>best.score?r:best,results[0]);
  }
  root.AussieCore={words,compare,cleanState,reviewOrder,spokenCheck,dailyPlan};
})(typeof window==='undefined'?globalThis:window);
