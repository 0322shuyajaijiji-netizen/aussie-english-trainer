// Vercel向け静的配布物。依存パッケージ・環境変数・ネットワークは不要。
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'dist');
const files=[
  'index.html','styles.css','app.js','core.js','speech.js','feedback.js',
  'conversation.js','scenarios.js','phrases.js','phrases.json',
  'translations.js','assets/scenes.svg','assets/mark.svg','assets/australia.svg','.nojekyll'
];
// 入力を確認してから出力を更新。設定やソースツリー全体は公開しない。
for(const file of files){
 const source=path.join(root,file);
 if(!fs.existsSync(source)||!fs.lstatSync(source).isFile()||fs.lstatSync(source).isSymbolicLink())throw Error(`配信ファイルがありません: ${file}`);
}
fs.rmSync(output,{recursive:true,force:true});
for(const file of files){
 const destination=path.join(output,file);
 fs.mkdirSync(path.dirname(destination),{recursive:true});
 fs.copyFileSync(path.join(root,file),destination);
}
console.log(`Vercel用の静的ファイル${files.length}件をdist/に出力しました。`);
