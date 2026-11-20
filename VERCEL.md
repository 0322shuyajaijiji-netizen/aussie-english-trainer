# Vercelへの公開準備

確認日：2026-11-20（日本時間）

このアプリはHTML / CSS / JavaScriptのみの静的アプリです。Next.js・Vite・Reactへの変換、サーバー、DB、APIキーは不要です。Vercelへの公開に対応した設定を追加しています。Vercelへのプロジェクト作成・デプロイは、この作業では実行していません。

## インポートするGitHubリポジトリ

https://github.com/0322shuyajaijiji-netizen/aussie-english-trainer

## Vercelの設定値

| 項目 | 値 |
| --- | --- |
| Framework Preset | **Other** |
| Root Directory | **リポジトリ直下（./）**。サブフォルダを指定しない |
| Build Command | `node scripts/build-vercel.mjs` |
| Output Directory | `dist` |
| Install Command | **空欄（スキップ）** |
| Environment Variables | **なし** |
| Production Branch | `main` |

Root DirectoryはVercelのプロジェクト設定で指定します。それ以外のビルド設定はルートの `vercel.json` に記載済みです。JSONの `framework: null` はOther、`installCommand: ""` は依存パッケージのインストールを省略する指定です。`package.json`、ロックファイル、`npm install` は不要です。

静的ファイルはビルドなしでも公開できますが、今回は必要な13ファイルだけを `dist/` にコピーする構成を採用しています。`original/`、テスト、開発スクリプト、Markdown文書、`.git/`、`.env`、Vercelの端末固有設定は配布物に含めません。アプリのJS・CSS・教材ファイルは変換せずコピーします。

## GitHubからVercelに公開する手順

1. Vercelにログインし、**Add New → Project** を開きます。
2. GitHubを接続し、上記リポジトリを **Import** します。候補にない場合はVercelのGitHub連携でこのリポジトリへのアクセスを許可してください。
3. 上表の設定値を確認します。Root Directoryはリポジトリ直下です。`scripts` や `dist` をRoot Directoryに選ばないでください。
4. 環境変数は追加しません。ビルド設定が `vercel.json` と一致していることを確認します。
5. **Deploy** を押すとVercelへの公開が始まります。
6. 発行されたHTTPSのProduction URLを開き、フレーズ・発音・暗記・会話練習を確認します。

Git連携後の `main` 更新は、GitHub Pagesに加えてVercelのProduction更新も起動します。Vercel側でProduction Branchや自動デプロイ設定を変えている場合は、その設定が適用されます。

## アプリ構成と互換性

- `index.html` がルートの入口。JS/CSSと `assets/` を相対パスで読み込みます。
- 画面切替は `#learn` などのURLハッシュです。サーバー側のSPAリライトやFunctionsは不要です。
- 169フレーズ・会話例はローカルの `phrases.js` / `phrases.json`、Extra Practiceは `scenarios.js` にあります。
- 学習記録はlocalStorage。Vercel用の外部データベースは不要です。
- 音声合成・認識と効果音はブラウザ機能です。VercelのAPI・Functionsで音声処理しません。
- 音声認識にはブラウザの対応、マイク権限、提供元サービスへの通信が必要です。ホスティングを移してもブラウザ側の制限は変わりません。
- VercelでもHTTPSのURLを使い、マイク権限を新しいURLで許可してください。

## 学習記録の移行

GitHub PagesとVercelは別オリジンです。**学習記録は自動では引き継がれません。**

1. 旧URLの「学習記録 → JSONで保存」でバックアップ。
2. Vercelの新URLで「学習記録 → バックアップを復元」。

プレビューURLとProduction URLの間でも、オリジンが異なれば記録は別々です。生徒への共有には固定のProduction URLを使ってください。

## 無料運用について

外部の有料API・DB・環境変数は必要ありません。VercelのHobbyは無料ですが、個人・非商用向けの利用条件と無料枠があります。学校・組織としての運用が対象になるかは利用形態に応じてVercelの条件を確認してください。Proへの切替や有料Add-onはこのアプリのためには不要です。無料枠を超えると利用制限がかかる場合があるため、「無制限・必ず無料」を保証するものではありません。既存のGitHub Pagesも維持しています。

## ローカル検証

```sh
node scripts/build-vercel.mjs
node scripts/check-release.mjs
node --test tests/*.test.mjs
```

`dist/` は生成物なのでコミット不要です。教材を編集した場合は先に `node scripts/build-data.mjs` を実行してください。新しい配信アセットを追加する場合は、`scripts/build-vercel.mjs` のファイル一覧にも追記します。

実際のVercel上のビルド・公開と、端末実機のマイク動作は、この準備作業では未検証です。

## 公式資料

- [Vercelのビルド設定](https://vercel.com/docs/builds/configure-a-build)
- [vercel.jsonの設定](https://vercel.com/docs/project-configuration/vercel-json)
- [GitHub連携](https://vercel.com/docs/git/vercel-for-github)
- [Hobbyプラン](https://vercel.com/docs/plans/hobby)
