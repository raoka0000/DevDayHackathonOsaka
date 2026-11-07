# CloudflareのDB・保存設計

確認日：2026-11-07。現段階は設計資料であり、クラウド上のDB作成・接続・マイグレーションは未実施。

## 採用方針

**曲の永続保存を追加する場合はCloudflare D1、写真などのファイル保存が必要になった場合はR2を使う。**
3時間版はこれまでどおりセッション内の編集・再生を先に完成させ、DB保存を追加するなら「保存・再読み込み」に絞る。
今回の資料追加によって、履歴やログインをMVPの必須機能にはしない。

D1はSQLデータベースで、Workerからバインディングで接続する。
R2にはファイルを置き、D1には曲の構造化データと必要な参照情報を置く。
根拠：[D1の導入](https://developers.cloudflare.com/d1/get-started/)、[R2のWorkers接続](https://developers.cloudflare.com/r2/get-started/workers-api/)。

| 保存対象 | MVP | 永続保存を追加する場合 |
| --- | --- | --- |
| コード・テンポ・伴奏パターン | ブラウザの編集中データ | D1にSongのJSON |
| 曲名・更新日時・所有セッション | セッション内 | D1の列 |
| AIの提案・元に戻すデータ | メモリ内 | 当面DBには保存しない |
| 元の写真 | プレビューとAI送信のみ | 必要になった場合のみ非公開R2 |
| MIDI | ブラウザで生成・ダウンロード | 原則保存せず曲データから再生成 |
| 音声ファイル | 生成せずブラウザで演奏 | WAV等を追加する場合にR2を検討 |
| APIキー | Workerの秘密情報 | DBに保存しない |

KV・Durable Objects・Queuesは初期構成に加えない。共同編集や長時間ジョブが必要になった時点で再検討する。

## 最小のテーブル案

永続保存を実装するときは、匿名セッションと曲の2テーブルから始める。
Songの内容はJSONでまとめ、各小節・音符を個別テーブルに分割しない。
アプリで再計算可能なNoteEventは保存しない。

```sql
CREATE TABLE anonymous_sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE songs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES anonymous_sessions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1 CHECK (schema_version >= 1),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  song_json TEXT NOT NULL CHECK (json_valid(song_json)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX songs_session_updated_idx ON songs(session_id, updated_at DESC);
CREATE INDEX anonymous_sessions_expiry_idx ON anonymous_sessions(expires_at);
```

- IDはサーバーで生成するランダムなID。時刻はUTCのUnix秒で統一する。
- song_jsonはARCHITECTURE.mdのSongを保存する。保存前にサーバーでスキーマ検証する。
- title・revision・idは列とJSONが一致するようにサーバーで組み立てる。
- schema_versionはデータ形式の版、revisionは保存済みの更新番号として分ける。
- MVPでは編集履歴テーブルを作らない。Undo用の直前データはブラウザに置く。
- DBの外部キー設定はD1の仕様に従う。[公式資料](https://developers.cloudflare.com/d1/sql-api/foreign-keys/)

## ログインなしで保存する場合のアクセス制御

ログインがなくても、曲IDだけで他人の曲を取得・更新できるAPIにはしない。

1. Workerが匿名セッションと十分に長いランダムなトークンを作る。
2. トークンはHttpOnly・Secure・SameSite付きCookie、DBにはハッシュだけを保存する。
3. 読み書きでセッションの期限と所有権を確認する。
4. 更新・削除などの操作ではOriginも検証する。
5. トークン・元写真・AIへの入力をアクセスログに残さない。

Cookieを失った場合は復元できないことを画面に説明する。端末間同期は対象外。
セッションの保存期間はデモでは24時間を初期案とし、公開時の説明と削除処理を揃える。
期限を過ぎたデータは読み取れないようにし、定期処理または運用手順で物理削除する。
D1の通常の行に自動TTL削除がある前提で実装しない。

## 保存API案

既存の生成APIと役割を分け、以下を永続化の追加機能とする。

| API | 役割 |
| --- | --- |
| `POST /api/session` | 匿名セッションの作成。既存の有効セッションがあれば再利用 |
| `POST /api/projects` | 現在の曲を新規保存 |
| `GET /api/projects` | 自分の曲の一覧。件数制限・ページングを付ける |
| `GET /api/projects/:id` | 自分の曲を取得 |
| `PUT /api/projects/:id` | expectedRevision付きで更新 |
| `DELETE /api/projects/:id` | 自分の曲を削除 |

直接編集はブラウザ内で行い、最初は保存ボタンでのみ書き込む。
生成・AI編集APIはDB保存と独立させ、DBがなくてもコア体験を開発できるようにする。
保存失敗時には編集中の曲を残し、成功したように表示しない。

## 更新の競合を防ぐ

保存時には、クライアントが最後に取得したDBのrevisionをexpectedRevisionとして送る。
Songのローカルrevisionとは別に保持し、未保存の編集回数をexpectedRevisionに使わない。

```sql
UPDATE songs
SET song_json = ?1, title = ?2, revision = revision + 1, updated_at = ?3
WHERE id = ?4 AND session_id = ?5 AND revision = ?6;
```

サーバーで次のDB revisionをJSONにも設定する。更新件数が0なら、所有権・存在を安全に確認したうえで
競合時は409を返す。最新データを勝手に上書きしない。
SQLは文字列結合せず、prepareとbindで値を渡す。
根拠：[Prepared statements](https://developers.cloudflare.com/d1/worker-api/prepared-statements/)。

## Cloudflareへの接続手順

以下はアプリのWorker構成とWranglerを用意した後に使う手順案。まだ実行していない。
開発用と本番用は別DBにし、それぞれ対応するWrangler設定・環境を使う。
下記は開発用の例で、本番DB作成・適用は実装時に別途設定する。

```sh
npx wrangler login
npx wrangler d1 create photochord-dev
```

作成結果のdatabase_idを、既存のwrangler.jsoncに以下の設定として統合する。
この断片だけでWorkerを公開できるわけではない。IDはプレースホルダーを置き換える。

```jsonc
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "photochord-dev",
      "database_id": "<作成結果のdatabase_id>",
      "migrations_dir": "migrations"
    }
  ]
}
```

```sh
npx wrangler d1 migrations create photochord-dev init
```

生成されたSQLファイルに確定したスキーマを書き、Gitで管理する。

```sh
npx wrangler d1 migrations apply photochord-dev --local
npx wrangler dev
```

ローカルで確認後、対象が開発用リモートDBであることを確認して適用する。

```sh
npx wrangler d1 migrations apply photochord-dev --remote
npx wrangler types
npx wrangler deploy
```

Workerからはenv.DBで接続する。ブラウザにDB接続情報を渡さない。
本番は本番用設定とDB名を使い、適用前に対象・差分・バックアップ方法を確認する。
適用済みマイグレーションは書き換えず、新規SQLで変更する。
根拠：[D1接続](https://developers.cloudflare.com/d1/get-started/)、[マイグレーション](https://developers.cloudflare.com/d1/reference/migrations/)。

## R2を後から追加する場合

元写真の保存をユーザーが求めた場合にのみ追加する。バケットは非公開とし、
Workerが所有権を確認して取得する方法を第一候補にする。
画像をD1にBase64で埋め込まず、D1にオブジェクトキーと種類・サイズを記録する。

ブラウザから直接アップロードする必要が出たら、短時間の署名付きURLとCORSを設計する。
署名付きURLの発行にはS3互換クライアントを使う。R2のWorkerバインディングだけで発行できる前提にしない。
根拠：[R2署名付きURL](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)。

D1とR2の更新は単一トランザクションと見なさず、失敗時の再試行と孤立ファイルの削除を設計する。
曲の削除時にはR2上の対応ファイルも削除する。保存期限・削除処理・画面説明を同時に追加する。

## 導入時の確認リスト

- [ ] D1なしでも生成・編集・再生・MIDI出力ができる。
- [ ] ローカルDBにスキーマを適用できる。
- [ ] 保存→再読み込みで曲が一致する。
- [ ] 別セッションから取得・更新・削除できない。
- [ ] revision競合を409として扱い、現在の編集を残す。
- [ ] 期限切れセッションを拒否し、削除できる。
- [ ] 保存失敗時に再試行できる。
- [ ] 開発DBと本番DBが分離されている。
- [ ] 公開時の料金・上限を公式ページで確認する。

料金や上限はここに固定値を転記しない。
[D1料金](https://developers.cloudflare.com/d1/platform/pricing/)・[D1制限](https://developers.cloudflare.com/d1/platform/limits/)・
[R2料金](https://developers.cloudflare.com/r2/pricing/)を導入時に確認する。
