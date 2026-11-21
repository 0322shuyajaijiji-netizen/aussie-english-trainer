import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>fs.readFileSync(path.join(root,file));
const config=JSON.parse(read('vercel.json'));
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?files(path.join(dir,entry.name)):[path.relative(path.join(root,'dist'),path.join(dir,entry.name))]).sort();}
test('VercelのOther設定で依存インストール・環境変数・APIサーバーが不要',()=>{
 assert.equal(config.framework,null);assert.equal(config.buildCommand,'node scripts/build-vercel.mjs');assert.equal(config.outputDirectory,'dist');assert.equal(config.installCommand,'');assert.equal(config.env,undefined);assert.equal(config.functions,undefined);assert.equal(config.rewrites,undefined);
});
test('Vercel出力は全配信ファイルを元のまま含み、秘密・開発ファイルを含めない',()=>{
 execFileSync(process.execPath,['scripts/build-vercel.mjs'],{cwd:root});
 const list=files(path.join(root,'dist'));assert.equal(list.length,15);
 for(const name of list){assert.deepEqual(read('dist/'+name),read(name));assert.doesNotMatch(name,/(?:^|\/)(?:\.env|\.git|\.vercel|tests|original|scripts)(?:\.|\/|$)|\.md$/);}
 const html=read('dist/index.html').toString();for(const ref of html.matchAll(/(?:href|src)="([^"#]+)"/g))assert.ok(fs.existsSync(path.join(root,'dist',ref[1])),ref[1]);
 assert.equal(JSON.parse(read('dist/phrases.json')).length,193);
});
test('再ビルドで古い配布物を除去し、キャッシュに不要ファイルを残さない',()=>{
 fs.mkdirSync(path.join(root,'dist'),{recursive:true});fs.writeFileSync(path.join(root,'dist','stale-secret.txt'),'test fixture, not a secret');execFileSync(process.execPath,['scripts/build-vercel.mjs'],{cwd:root});assert.equal(fs.existsSync(path.join(root,'dist','stale-secret.txt')),false);assert.equal(files(path.join(root,'dist')).length,15);
});
