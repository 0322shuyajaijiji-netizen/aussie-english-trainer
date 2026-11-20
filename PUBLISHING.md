# 公開と更新（GitHub Pages / Vercel）

現在の本番URL（Vercel）：

https://english-conversation-six.vercel.app/

2026-11-20にログイン不要の公開と169フレーズの配信を確認しました。GitHub Pagesはまだ有効です。停止APIはGitHub連携の設定変更権限不足（403）で拒否されたため、次の操作を管理者が行ってください。

## GitHub Pagesを停止する

1. 必要な学習記録があれば、旧サイトの **学習記録 → JSONで保存** からバックアップし、Vercel側で復元します。URLごとに保存領域が異なります。
2. [Settings → Pages](https://github.com/0322shuyajaijiji-netizen/aussie-english-trainer/settings/pages) を開きます。
3. **Build and deployment → Branch** を **None** に変更し、**Save** を押します。

リポジトリや教材ファイルは削除しません。Vercelの公開とGitHub連携は維持されます。

## 現在の状態

- 最新版のアプリ、169フレーズ（元教材129件＋追加40件）、全会話例、追加分岐、テスト、教材変更履歴を収録。
- HTML / CSS / JavaScriptのみ。APIキー・ビルド・サーバー・DB・有料サービスは不要。
- GitHub Pagesで使える相対パスと `.nojekyll` を配置済み。
- 独自の公開ワークフローはありません。GitHub Pagesの設定で `main` / `/(root)` を配信しているため、`main` の更新でサイトも更新されます。
- ブラウザ実機での表示・マイク・音声認識は未確認。`TEST_REPORT.md` に確認項目があります。

## GitHub Pagesを再公開する場合

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

同じリポジトリの `main` を更新すると、GitHub連携したVercelが自動でビルド・公開します。GitHub Pagesは停止するまでmain更新で再配信されるため、上記のBranch設定をNoneにしてください。

教材を変更した場合だけ、次を実行して `phrases.js` も更新してください。

```sh
node scripts/build-data.mjs
node scripts/check-release.mjs
node --test tests/*.test.mjs
```

## Vercelの設定

Vercelでは `vercel.json` に従って `dist/` を配信します。環境変数は不要です。具体的な設定表・手順は [VERCEL.md](VERCEL.md) を参照してください。
