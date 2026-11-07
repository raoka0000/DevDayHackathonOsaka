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

## #1 実装済みの音符編集契約（2026-11-07）

上記Song/APIは将来のAI接続用の設計案。現在の実装は `src/music.ts` の `Song = { bpm, pattern, bars }` と `Track = Song & { notes: Note[] }` を使います。Noteのフィールドは上記NoteEventと同じです。

- `notesFor(Song)` は初期生成専用。`createTrack` で初期音符を保持し、その後は `Track.notes` を正本とします。
- `playbackNotes` が設定・音符を検証し、Playerと `midiFor(Track)` に同じ音符を渡します。旧来の `midiFor(Song)` は固定設定の互換入口として生成音符を使います。
- 音高は整数48〜84、開始拍は有限の0以上32未満、長さは有限の0.25以上で終端32以下、強さは整数1〜127。同音高の時間重複は拒否し、接する終端と次の開始は許可します。空配列は有効です。
- UIの追加・移動は0.25拍刻み。リサイズだけ長さを量子化し、移動では元の長さを保持します。数値欄は生成済み0.45/3.8拍を保てる精度を許可します。
- `replaceNote`、`regenerate` は元配列を変更せず、全体検証に成功してから返します。コード再生成は開始拍が対象小節に属する音符を置換し、パターン再生成は全音符を置換します。対象範囲を画面に提示して承認後に適用します。
- `EditorState` は現在のTrackと最大30件のTrack履歴。`commit` は無変更では履歴を増やさず、`undo` は設定と音符を一括復元します。ドラッグ中は別のdraftに保持し、pointerupのみcommit、Escape/pointercancel/lostpointercaptureは破棄します。
- Playerの位置はAudioContext.currentTimeから拍単位で計算します。新しい再生と停止は前のContextを閉じ、resume待ちの古い演奏は予約しません。

API・永続保存は未実装です。将来の保存では手編集音符を省略せず、Track.notesも保存・検証する必要があります。

実装時に確認した公式資料：[React useRef](https://react.dev/reference/react/useRef)、[Pointer capture](https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture)、[AudioContextのクロック](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/currentTime)。

## MIDI編集画面の分離

他担当者との変更競合を減らすため、MIDI編集は `#/midi` の独立した画面に分離した。写真・コード編集は `#/`（初期URLはハッシュなしでも可）。ルーターの追加依存やサーバー設定変更を必要としないハッシュ遷移を使う。

- 今後のMIDI画面の詳細化は `src/midi/MidiEditorScreen.tsx`、`src/midi/PianoRoll.tsx`、`src/midi/midi.css` 内で進める。専用CSSのセレクターは `.midi-screen` 以下に限定する。
- `MidiEditorScreenProps` が画面境界。Track・再生位置・Undo可否と、編集/停止/再生/Undo/出力のコールバックを受け取る。画面内で別の曲・履歴・Playerを作らない。
- Appが曲・履歴・写真・Playerを保持するため、画面のアンマウントで編集内容は消えない。画面移動時は再生を止めて再生成確認を破棄する。音符選択など画面内の一時状態は戻った際に初期化する。
- 写真/AI/音色の担当者は既存画面と共有サービスを担当し、MIDI画面担当者は専用ディレクトリを中心に変更する。Track・Player・MIDI出力の契約を変更する場合は双方で調整する。
