# OpenAIによる画像の印象分析：準備と個別確認

LOCAL-002は作業中。アプリ画面とWorkerの分析APIを接続したが、実OpenAI・実ブラウザ・Cloudflareでの動作は未確認。写真から人物の本当の感情を判定するものではなく、写真全体から音楽制作のきっかけとなる主観的な印象と8小節の伴奏を提案する。

## モデルと費用

画像入力と構造化出力に対応する [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna) を使用する。2026-11-07時点の公式掲載価格はテキスト入力100万トークンあたり$0.10、出力100万トークンあたり$0.50。画像も入力トークンとして課金され、画像の枚数・設定・出力の量により費用は変わる。[画像入力の料金と解像度](https://developers.openai.com/api/docs/guides/images-vision) と [最新料金](https://developers.openai.com/api/docs/pricing) を実行前に確認する。`detail: low`、出力上限1536トークン、複数画像を1回の呼び出しにまとめる。アカウントでのモデル利用可否は実際に確認する必要がある。

## 事前準備

1. [OpenAI Platform](https://platform.openai.com/) でAPI用のプロジェクト、課金・利用枠、モデルへのアクセスを準備し、プロジェクトのAPIキーを作成する。ChatGPTの契約とAPIの利用枠は別途確認する。キーはチャットやGitに貼らない。
2. リポジトリ直下に **`.dev.vars` という名前の新しいファイル**を作り、次の1行を記入する。実際のキーに置き換える。この説明書にはキーを記入しない。`.dev.vars` はGit管理対象外。共有端末ではファイルのアクセス権を制限し、不要になったら削除・必要に応じてキーを無効化する。

   ```text
   OPENAI_API_KEY=ここに自分のAPIキー
   ```

3. Node.js 24を用意し、送信してよいJPEG、PNG、WebP画像を1〜5枚準備する。これは開発者用の確認手順。将来の利用者はアプリ画面から自分のPCの写真を選ぶ。コマンド実行により指定した画像がOpenAIに送信され、API料金が発生する。

## 個別確認

リポジトリ直下で実行する。パスに空白がある場合は引用符で囲む。スクリプトは画像の拡張子とサイズだけを事前確認する手動検証用であり、公開APIに必要な画像の内容検証ではない。

```sh
node --env-file=.dev.vars scripts/check-openai-image.mjs "画像1.jpg" "画像2.png" "画像3.webp"
```

成功時は複数画像をまとめた印象と `song`（BPM、パターン、8小節）が表示される。手動確認の仮上限は1枚10 MiB、合計20 MiB。`configuration` はキー未設定、`invalid_input` は画像枚数不正、`timeout` は時間切れ、`upstream` は認証・利用枠・通信などの失敗、`invalid_response` は拒否・未完了・形式不正などを表す。安全のため外部APIの詳細なエラー本文は表示しない。原因はOpenAI側の利用状況・認証設定を確認する。**この手順は実キー・実画像では未検証。**

## 写真の取扱いと公開前の作業

この手動確認と将来のWorkerは、指定画像をOpenAI APIに送信する。アプリ側の永続保存は行わず、Responses APIには `store: false` を指定する。ただしOpenAIの不正利用監視などによる保持は別に適用されるため、保存ゼロとは説明しない。現在の条件・例外は [OpenAIのデータ管理](https://developers.openai.com/api/docs/guides/your-data) を参照する。

公開時はキーを `npx wrangler secret put OPENAI_API_KEY` でWorkerの秘密情報に設定する（デプロイ先とアカウントの確認が必要）。このコマンドと公開手順は本環境では未実行。`npm run dev` は初回ビルド後にWorker（127.0.0.1:8788）とViteを一括起動し、画面用URL（通常 http://localhost:5173）の `/api/` をWorkerへ転送する。`.dev.vars` はWorkerのみが読み込み、変更時は再起動する。Viteから入力エラー400と未定義APIの404のJSON応答を確認済み。`npm run cf:dev` でWorkerと画面を起動し、表示されたURL（通常 http://localhost:8787）を開く。ローカル起動、秘密情報のバインド、画像なしPOSTが400のJSONを返すことを確認済み。実画像の分析成功は未確認。画像の完全なデコード検証と外部からのリクエスト数を制限する仕組みは未実装。公開前に実環境と利用上限を確認する。

## 画面でエラーが出た場合

画面はAPIのエラーコードに応じ、キー未設定・画像不正・容量超過・時間切れ・OpenAI側の失敗・応答形式不正を区別する。JSON以外の応答の場合はWorkerの起動とAPIルーティングを確認する案内を表示する。外部APIの生のエラー本文やキーは表示しない。`upstream` の場合は認証・課金／利用枠・モデルアクセス・通信のどれかまでは未確定であり、サーバー設定とOpenAIの利用状況を確認する。

写真別の音楽設定は `song.sections` で受け渡す。各写真の開始小節・BPM・伴奏パターン・3パートの音色IDを必須とし、写真の割当との一致を検証する。構造化出力のスキーマは[公式資料](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses)に従い、各オブジェクトの全項目をrequiredとしadditionalPropertiesをfalseにする。実AIの新しい応答は未確認。
