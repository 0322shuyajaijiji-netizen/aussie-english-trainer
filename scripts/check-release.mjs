import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const html=read('index.html');
const runtime=['index.html','styles.css','app.js','core.js','speech.js','scenarios.js','phrases.js','phrases.json','assets/mark.svg','assets/australia.svg','.nojekyll'];
for(const f of runtime)assert.ok(fs.existsSync(path.join(root,f)),`必要なファイルがありません: ${f}`);
// /repository-name/ の下でのGitHub Pages配信を前提に参照を検査。
for(const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)){
 const value=match[1];
 assert.ok(!value.startsWith('/')&&!/^https?:|^\/\//.test(value),`相対パスが必要: ${value}`);
 assert.ok(fs.existsSync(path.join(root,value)),`参照先なし: ${value}`);
}
for(const match of read('app.js').matchAll(/src="(assets\/[^"$]+)"/g))assert.ok(fs.existsSync(path.join(root,match[1])),`動的アセットなし: ${match[1]}`);
const data=JSON.parse(read('phrases.json'));
assert.equal(data.length,129);assert.equal(new Set(data.map(x=>x.id)).size,129);
assert.deepEqual(data,JSON.parse(read('original/phrases.json')));
const context={window:{}};vm.runInNewContext(read('phrases.js'),context);
assert.equal(JSON.stringify(data),JSON.stringify(context.window.PHRASES),'教材JSONと生成JSが不一致');
for(const f of ['index.html','styles.css','app.js','core.js','speech.js','scenarios.js']){
 const text=read(f).replace(/xmlns="[^"]*"/g,'');
 assert.doesNotMatch(text,/fetch\s*\(|XMLHttpRequest|https?:\/\//i,`外部サービス依存: ${f}`);
 assert.doesNotMatch(text,/gh[pousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}|BEGIN (?:RSA |OPENSSH )?PRIVATE KEY/,`秘密情報らしき内容: ${f}`);
}
assert.equal(fs.existsSync(path.join(root,'.openai')),false,'確認サイト専用設定を含めないでください');
assert.equal(fs.existsSync(path.join(root,'.github/workflows')),false,'公開前の自動実行ワークフローは不要です');
console.log('公開準備チェック成功: 必須ファイル・相対パス・129教材一致・外部API依存なし・公開トリガーなし');
