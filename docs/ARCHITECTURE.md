# 構成案・データ契約

以下は実装前の設計案。具体的なサービス・ライブラリとCloudflare設定は未確定。

## 基本設計

画像 → AIによる印象と音楽設定の提案 → 検証済みの曲データ → 音符の組み立て → 再生・MIDI出力。
直接編集とAI編集は同じ曲データに反映する。
音声生成APIによる波形の生成はMVPの必須構成にしない。

- 画面：React + TypeScript。
- 公開・API：Cloudflare Workers。現行の公式資料に従って構成する。
- AI：画像入力と構造化出力を扱えるサービス。プロバイダーは未選定。
- 再生：ブラウザの音声機能を使うライブラリを選定。鍵盤音色を1種類用意する。
- MIDI：曲データから生成した音符をファイルに変換するライブラリを選定。
- 保存：初期版はブラウザのセッション内。永続化する場合はD1、写真保存は必要時のみR2を使う。
- テーブル・接続・アクセス制御・マイグレーションは[DB設計](DATABASE.md)を参照。

## 曲データの案

```ts
type Chord = {
  root: number; // C=0 ... B=11
  quality: "major" | "minor"; // MVPでは三和音に限定
};

type Song = {
  id: string;
  revision: number;
  title: string;
  mood: string[];
  explanation: string;
  key: { tonic: number; mode: "major" | "minor" };
  bpm: number;
  timeSignature: [4, 4];
  bars: Chord[]; // 8個、各コードは1小節
  pattern: "block" | "arpeggio";
};

type NoteEvent = {
  pitch: number; // MIDIノート番号
  startBeat: number;
  durationBeats: number;
  velocity: number; // 1〜127
};

type EditProposal = {
  baseRevision: number;
  reason: string;
  candidate: Song;
};
```

コードの音域・転回形・リズムはアプリ側で規則的に組み立てる。
再生とMIDI出力は同じNoteEvent配列を使い、音の高さ・長さ・テンポを一致させる。
AIのJSONをそのまま信頼せず、ルート音、コード種別、キー、BPM、小節数、文字列長を検証する。
対応外の指定は説明付きで再提案し、未対応の音楽データを黙って捨てない。

## API案

| エンドポイント | 入力 | 出力 |
| --- | --- | --- |
| `POST /api/songs` | 写真・任意の用途や希望 | 検証済みSong |
| `POST /api/songs/edit` | 現在のSong・自然言語の指示 | 検証済みEditProposal |

写真はサーバー経由でAIに渡し、初期版では保存しない。
画像のサイズ・形式・送信形式は採用AIとWorkersの制限を確認して決める。
AIキーはサーバーの秘密情報として扱う。タイムアウト・二重送信・実行回数の制限を用意する。

## 編集と再生

- 現在の曲、提案中の曲、直前の曲を別々に持つ。
- 直接編集と適用時にrevisionを更新し、変更前の曲を保持する。
- AIリクエストは送信時のrevisionを保持し、応答時に一致しなければ適用不可として再依頼する。
- 提案の試聴は保存せず、適用ボタンでのみ現在の曲を更新する。
- 新規画像による再生成で編集を失う場合は、実行前に画面で明示する。
- 再生はユーザー操作で開始し、停止で予約音と発音中の音を止める。
- 編集・曲切り替え時は停止し、再生位置を先頭へ戻す。
- 共通クロックから小節表示を更新し、再生ボタン連打で多重演奏させない。

## 未決事項

- 画像AIのモデル、認証情報、費用、応答時間、構造化出力の方式。
- 音声・MIDIのライブラリ、音色の利用条件と読み込みサイズ。
- 初期生成で対応するキーとコードの選択肢。
- Cloudflareアカウント、デプロイ認証、利用プランの制限。

実装開始時に公式資料で確認し、確定した選択と実行手順をREADMEに残す。
