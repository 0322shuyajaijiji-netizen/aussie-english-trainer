// 追加の分岐練習。教材原文・会話例とは別データです。
window.BRANCHES = [
 {id:'cafe',title:'カフェで注文',icon:'☕',intro:'飲み物を注文して、店内か持ち帰りかを伝えよう。',start:'order',nodes:{
 order:{partner:'Hi! What can I get you?',options:[{en:'Can I get a latte?',ja:'ラテをください。',next:'where'},{en:'What do you recommend?',ja:'おすすめを聞いてみる。',next:'recommend'}]},
 recommend:{partner:'Our flat white is popular. Would you like one?',options:[{en:'Yes, please.',ja:'おすすめを注文する。',next:'where'},{en:'Can I get a latte?',ja:'ラテを注文する。',next:'where'}]},
 where:{partner:'Having here, or take away?',options:[{en:'I’m having it here.',ja:'店内で飲む。',next:'here'},{en:'Take away, please.',ja:'持ち帰る。',next:'away'}]},
 here:{partner:'Sure! Take a seat. We’ll bring it over.',options:[]},away:{partner:'No worries! It’ll be ready in a minute.',options:[]}}},
 {id:'airport',title:'空港でチェックイン',icon:'✈',intro:'座席の希望を伝え、搭乗ゲートを確認しよう。',start:'check',nodes:{
 check:{partner:'Hello. May I see your passport, please?',options:[{en:'Here you are. I’m checking in for my flight.',ja:'パスポートを渡す。',next:'seat'}]},
 seat:{partner:'Thank you. Do you have a seat preference?',options:[{en:'Could I get an aisle seat?',ja:'通路側を希望する。',next:'gate'},{en:'Could I get a window seat?',ja:'窓側を希望する。',next:'window'}]},
 window:{partner:'I’m sorry, the window seats are taken. Is an aisle seat OK?',options:[{en:'Yes, that’s fine. Thank you.',ja:'通路側にする。',next:'gate'},{en:'We’d like to sit together.',ja:'一緒に座りたいと伝える。',next:'together'}]},
 together:{partner:'Let me check. Yes, I can put you together.',options:[{en:'Thank you. Which gate do I go to?',ja:'搭乗ゲートを聞く。',next:'end'}]},
 gate:{partner:'Here’s your boarding pass. Do you have any questions?',options:[{en:'Which gate do I go to?',ja:'搭乗ゲートを聞く。',next:'end'},{en:'What time is boarding?',ja:'搭乗時刻を聞く。',next:'time'}]},
 end:{partner:'Gate twelve. Have a good flight!',options:[]},time:{partner:'Boarding starts at ten thirty at gate twelve.',options:[]}}},
 {id:'school',title:'学校で友達をつくる',icon:'✎',intro:'自己紹介をして、共通の興味を見つけよう。',start:'hello',nodes:{
 hello:{partner:'Hi! I’m Alex. What’s your name?',options:[{en:'Nice to meet you. Call me Shuya.',ja:'教材の名前で自己紹介する。',next:'hobby'},{en:'Hi! How’s it going?',ja:'あいさつから始める。',next:'greeting'}]},
 greeting:{partner:'Pretty good! What do you do in your free time?',options:[{en:'I’m really into Minecraft.',ja:'ゲームの話をする。',next:'game'},{en:'I like science. What made you interested in math?',ja:'理数の話をする。',next:'science'}]},
 hobby:{partner:'Nice to meet you! What do you do in your free time?',options:[{en:'I’m really into Minecraft.',ja:'ゲームの話をする。',next:'game'},{en:'I like science. What made you interested in math?',ja:'理数の話をする。',next:'science'}]},
 game:{partner:'Me too! Let’s play sometime.',options:[{en:'We have so much in common. Let’s keep in touch.',ja:'連絡を取り合おうと伝える。',next:'end'}]},
 science:{partner:'I enjoy solving problems. What about you?',options:[{en:'That’s so interesting. Let’s keep in touch.',ja:'興味を伝える。',next:'end'}]},
 end:{partner:'Definitely. Catch you later!',options:[]}}},
 {id:'daily',title:'街で道を聞く',icon:'⌖',intro:'道がわからないとき、質問したり聞き返したりしよう。',start:'lost',nodes:{
 lost:{partner:'Hi there. Do you need a hand?',options:[{en:'We got lost. How do I get to the station?',ja:'駅への道を聞く。',next:'directions'},{en:'Are there any cafes around here?',ja:'近くのカフェを聞く。',next:'cafe'}]},
 directions:{partner:'Go straight and turn left at the next street.',options:[{en:'Could you say that again?',ja:'もう一度言ってもらう。',next:'repeat'},{en:'How far is it from here?',ja:'距離を聞く。',next:'distance'}]},
 repeat:{partner:'Of course. Straight ahead, then left. It’s a five-minute walk.',options:[{en:'Thank you. I really appreciate it.',ja:'感謝する。',next:'end'}]},
 distance:{partner:'About five minutes on foot.',options:[{en:'That’s very kind of you. Thank you.',ja:'感謝する。',next:'end'}]},
 cafe:{partner:'Yes! There’s one just across the road.',options:[{en:'Thank you for your help.',ja:'感謝する。',next:'end'}]},
 end:{partner:'No worries. Have a good one!',options:[]}}}
];
