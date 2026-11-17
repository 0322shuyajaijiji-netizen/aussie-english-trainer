# GitHub Pages 公開直前の手順

このプロジェクトはGitHub Pagesで公開済みです。

https://0322shuyajaijiji-netizen.github.io/aussie-english-trainer/

## 現在の状態

- 最新版のアプリ、129フレーズ、全会話例、追加分岐、テスト、教材変更履歴を収録。
- HTML / CSS / JavaScriptのみ。APIキー・ビルド・サーバー・DB・有料サービスは不要。
- GitHub Pagesで使える相対パスと `.nojekyll` を配置済み。
- 独自の公開ワークフローはありません。GitHub Pagesの設定で `main` / `/(root)` を配信しているため、`main` の更新でサイトも更新されます。
- ブラウザ実機での表示・マイク・音声認識は未確認。`TEST_REPORT.md` に確認項目があります。

## GitHub Pagesの設定（現在は設定済み）

GitHubの無料プランでGitHub Pagesを使うため、まずリポジトリを **Public（公開）** にします。Publicにするとアプリだけでなくソースコード・教材データ・Git履歴も閲覧可能になります。

1. GitHubリポジトリの **Settings → General → Danger Zone → Change repository visibility** で **Public** にします。
2. **Settings → Pages → Build and deployment → Source** を **Deploy from a branch** にします。
3. Branchを **main**、フォルダを **/(root)** にします。
4. **Save** を押します。**この操作でGitHub Pagesへの公開が始まります。**
5. 数分後、Pages画面の **Visit site** で公開URLを開きます。URLは `https://GitHubユーザー名.github.io/aussie-english-trainer/` の形式です。
6. HTTPSで開き、PCとスマートフォンからお手本音声・音声認識を確認します。

独自ドメイン・支払い方法・環境変数・APIキーの登録は不要です。教材の公開権限を確認した上で実行してください。

## 確認サイトから学習記録を移す場合

現在の確認サイトとGitHub Pagesは別のURLなので、学習記録は自動で引き継がれません。確認サイトの **学習記録 → JSONで保存** を使い、公開後にGitHub Pages側で **バックアップを復元** してください。

## 公開後の更新

同じリポジトリの `main` を更新すると、GitHub Pagesも更新されます。公開を停止する場合はSettings → Pagesの公開元を無効にします。

教材を変更した場合だけ、次を実行して `phrases.js` も更新してください。

```sh
node scripts/build-data.mjs
node scripts/check-release.mjs
node --test tests/*.test.mjs
```
