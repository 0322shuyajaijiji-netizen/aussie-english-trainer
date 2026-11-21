// 日本語訳はローカル教材。翻訳サービスやAPIは使用しません。
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const translations=JSON.parse(fs.readFileSync(path.join(root,'dialogue-ja.json'),'utf8'));
const data=JSON.parse(fs.readFileSync(path.join(root,'phrases.json'),'utf8'));
const context={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'scenarios.js'),'utf8'),context);
const lines=[...data.flatMap(p=>p.dialogue.map(d=>d.text)),...context.window.BRANCHES.flatMap(b=>Object.values(b.nodes).flatMap(n=>[n.partner,...n.options.map(o=>o.en)]))];
for(const text of lines)if(typeof translations[text]!=='string'||!/[ぁ-んァ-ヶ一-龠]/.test(translations[text]))throw Error(`日本語訳がありません: ${text}`);
fs.writeFileSync(path.join(root,'translations.js'),'// 自動生成: scripts/build-translations.mjs（編集は dialogue-ja.json へ）\nwindow.DIALOGUE_JA = '+JSON.stringify(translations,null,2)+';\n');
console.log(`会話の日本語訳を検証・生成しました（${new Set(lines).size}種類のセリフ）。`);
