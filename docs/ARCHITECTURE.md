# 構成案・データ契約

以下は実装開始のための設計案。APIやCloudflareの設定は未実装。

## 構成案

- 画面：React + TypeScript。
- 配信・API：Cloudflare Workers。静的アセットとサーバー処理の公開方法は公式資料で確認する。
- 保存：外部APIに渡す画像や音源の保存が必要ならCloudflare R2を使う。
- 構成生成：画像を扱えるAI API。プロバイダーは未選定。
- 音楽生成：ジョブ作成・状態確認・音源取得ができる外部API。プロバイダーは未選定。
- 映像：ブラウザの共通タイムラインで画像・テロップ・音楽を制御する。

画像のプレビューはローカルで開始できる。外部AIに渡す場合はアップロードの旨を表示し、
リクエストサイズ制限や画像入力方式に合わせて送信方法を決める。
R2を使う場合は、公開範囲・取得URL・保存期間・削除方法を実装時に決める。

## 処理の流れ

1. 入力を検証し、画像IDと入力テキストをまとめる。
2. サーバーからAIを呼び、構成・テロップ・音楽プロンプトを生成する。
3. 構成を検証する。画像IDが入力内に存在し、全シーンが合計15秒であることを確認する。
4. 音楽生成ジョブを開始し、ジョブIDを画面に返す。
5. 画面から状態を定期確認する。失敗・タイムアウト・再試行を扱う。
6. 音源が取得可能になったら完成状態にする。
7. ユーザーの再生操作で音源を開始し、その再生位置を基準に映像を表示する。

音楽が15秒より長い場合はPVの終了時に停止する。短すぎる場合や読み込めない場合を成功扱いしない。
ジョブ状態はサーバープロセス内のメモリだけに依存させず、プロバイダー側のジョブか永続ストアで管理する。

## 共有するデータ形状（案）

```ts
type Mood = "fresh" | "cool" | "emotional";

type Scene = {
  imageId: string;
  durationSeconds: number;
  caption: string;
  effect: "zoom-in" | "zoom-out" | "static";
};

type PVPlan = {
  title: string;
  durationSeconds: 15;
  scenes: Scene[];
  musicPrompt: string;
};

type MusicJob =
  | { id: string; status: "queued" | "processing" }
  | { id: string; status: "completed"; audioUrl: string }
  | { id: string; status: "failed"; message: string };
```

## アプリAPI案

| エンドポイント | 用途 |
| --- | --- |
| `POST /api/plans` | 画像・テーマから検証済みPVPlanを返す |
| `POST /api/music` | musicPromptからジョブを作成する |
| `GET /api/music/:id` | 音楽生成の状態と完成音源を返す |

入力画像の送信形式、ジョブIDのアクセス制御、連続実行の制限は実装時に決める。
生成サービスへの接続はアダプターに分け、モックを使う場合は画面に明記する。

## 最初に確認する未決事項

- 利用できるAI・音楽生成サービス、認証情報、費用、生成所要時間。
- 生成音源のブラウザ再生形式、CORS、URLの有効期限、保存・公開・利用条件。
- Cloudflareの利用アカウント、デプロイ認証、採用プランの制限。
- R2を必要とするか、必要な場合の保存と削除の方法。

秘密情報はWorkersのシークレット機能で管理し、具体的な変数名は選定後にサンプルへ記載する。
