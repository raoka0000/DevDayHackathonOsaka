# PhotoChord（仮称）

**写真から音楽のたたき台を作り、自分とAIで編集できるWebアプリ。**
3時間のハッカソンで実装し、Cloudflareで公開したサイトを発表時に操作する。

たとえば結婚式の写真を選ぶと、AIが「祝福・明るさ・温かさ」という印象を提案し、
明るいコード進行の伴奏が入った状態から始められる。
ユーザーはコードやテンポを直接変えたり、「もう少し感動的に」とAIに頼んだりできる。
画像の印象は一つの提案として扱い、ユーザーが変更できる。

## ユーザー体験

1. 写真を1枚選ぶ。
2. AIが画像の印象と、キー・テンポ・8小節のコード進行を提案する。
3. その場で音楽を再生する。
4. 小節ごとのコード、テンポ、伴奏パターンを簡単に編集する。
5. AIに変更を依頼し、提案を試聴してから適用する。元に戻すこともできる。
6. 編集した曲をMIDIファイルとして書き出す。

## MVPの完成条件

- Cloudflareの公開URLから利用できる。
- 画像に基づくAIの提案から、8小節のコード伴奏を生成・再生できる。
- コード・テンポ・伴奏パターンの変更が実際の音に反映される。
- AIへの変更依頼をプレビュー・適用・取り消しできる。
- 編集後の内容をMIDIとしてダウンロードできる。
- 読み込み中・失敗・再試行を表示し、サンプルはサンプルと明示する。

音楽は音符・コード・テンポを保持する構造化データとして扱う。
音声生成APIは必須にせず、画像を扱うAIの提案からアプリが音符を組み立てて再生する。

## 開発資料

- [企画・受け入れ条件](docs/PRODUCT.md)
- [構成案・データ契約](docs/ARCHITECTURE.md)
- [CloudflareのDB・保存設計](docs/DATABASE.md)
- [3時間の実装タスク](docs/TASKS.md)
- [ChatGPTへの開発依頼文](docs/CHATGPT_HANDOFF.md)
- [開発エージェントへの指示](AGENTS.md)

## 現在の状態

React + TypeScript + Viteの叩き台を実装済みです。写真プレビュー、固定サンプルの8小節伴奏、コード・テンポ（60〜160 BPM）・伴奏パターンの編集、再生・停止・最初から再生、元に戻す、MIDI出力を利用できます。

**画像AI・自然言語のAI編集・永続保存は未接続です。** 写真から曲を分析・生成する機能はまだありません。写真はブラウザ内で表示するだけで、外部送信・保存しません。再読み込みすると編集は消えます。音色はWeb Audioの合成音です。Cloudflareへの公開は未実施です。

## 初回準備（Windows / macOS共通）

1. [Node.js公式サイト](https://nodejs.org/)から **Node.js 24 LTS** をインストールします（最低22.12以上）。WindowsではインストーラーのnpmとPATH設定を有効にします。
2. ターミナルを開き直し、`node -v` と `npm -v` が表示できることを確認します。
3. Gitでこのリポジトリを取得するか、ZIPを展開します。**package.jsonのあるフォルダー**をターミナルで開きます。

WindowsのPowerShell例（パスは自分の配置場所に変更）：

```powershell
cd "C:\Users\自分の名前\Desktop\DevDayHackathonOsaka"
npm.cmd ci
npm.cmd run dev
```

macOSのターミナル例：

```sh
cd "/Users/自分の名前/Desktop/DevDayHackathonOsaka"
npm ci
npm run dev
```

表示されたURL（通常 **http://localhost:5173**）をChrome / Edgeなどのブラウザで開きます。ポートが使用中ならViteが表示する別のURLを使ってください。停止はターミナルで **Ctrl+C**。次回からは `npm run dev` だけで起動できます（Windowsは `npm.cmd run dev`）。

Windowsで「スクリプトの実行が無効」と表示される場合は、上記のように `npm` の代わりに **npm.cmd** を使ってください。実行ポリシーの変更やWSLは不要です。`node` が見つからない場合はNode.jsをインストールしてターミナルを開き直してください。macOSのnode_modulesをWindowsへコピーせず、それぞれの端末で `npm ci` を実行します。

## 操作手順

1. 初期表示の固定サンプルで「再生する」を押す（写真の選択なしでも利用可）。
2. 必要ならJPEG / PNG / WebPの写真を1枚選択する（10MBまで）。写真はプレビュー専用です。
3. 小節ごとのコード、テンポ、伴奏パターンを変更して再生する。編集中は演奏が止まります。
4. 「元に戻す」で最大30回の直前編集に戻る。
5. 「MIDIを書き出す」で `photochord.mid` を保存し、MIDI対応DAWなどで開く。

画像の変更だけでは曲を置き換えません。「サンプルを読み直す」は編集中の曲を固定サンプルに置き換えます。ブラウザの再読み込みで曲が消えるため、必要な結果はMIDIで書き出してください。MIDIに写真は含みません。

## コマンド一覧

以下は両OS共通です。PowerShellでは必要に応じて `npm.cmd` / `npx.cmd` に置き換えてください。シェル固有の環境変数指定やUnixコマンドは不要です。

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

`preview` はビルド済み画面の確認用です（通常 http://localhost:4173）。`dist/index.html` を直接開かず、HTTPサーバー経由で使ってください。

## Cloudflare Workersへの公開

CloudflareのアカウントとWorkersへのデプロイ権限が必要です。APIキーなしでも現在の固定サンプル版を公開できます。既存Workerを上書きしないよう、必要に応じて `wrangler.jsonc` の `name` を自分の一意な名前に変更してください。

```sh
npx wrangler login
npm run cf:dev
```

ブラウザ認証を完了し、`cf:dev` が表示するローカルURLで静的アセットを確認します。Ctrl+Cで停止して、公開する場合は以下を実行します。

```sh
npm run deploy
```

表示された `https://...workers.dev` を開きます。これは**公開サイト**となるため、現時点では個人情報を含むサンプル素材などをソースに追加しないでください。画像選択時の写真は公開サーバーに送信されません。

設定は[Viteの導入](https://vite.dev/guide/)と[Cloudflare Workersの静的アセット設定](https://developers.cloudflare.com/workers/static-assets/binding/)を参照しています。

## 構成と次の作業

- `src/main.tsx`：日本語UI、画像プレビュー、編集状態。
- `src/music.ts`：曲の型・入力検証・音符生成・MIDI出力。
- `src/player.ts`：Web Audioでの再生・停止。
- `wrangler.jsonc`：Cloudflare Workersの静的配信設定。
- `tests/music.test.ts`：音符・検証・MIDIの解析テスト。

次はCloudflare公開と公開環境での操作確認、その後サーバー側の画像AIと編集提案APIの接続を進めます。AIの認証情報は未設定です。実装状況と検証結果は [docs/TASKS.md](docs/TASKS.md) を参照してください。

## 今回の検証

開発環境のNode.js 26.13.0で、依存インストール、型チェックを含む本番ビルド、3件の音楽・MIDIテスト、開発サーバー起動、ブラウザでの画面表示を確認しました。Windows実機・音声実聴・外部DAW・Cloudflare公開は未検証です。

## AIによるイシュー駆動開発

共有スキルを `.agents/skills/` に用意しています。

- [create-issues](.agents/skills/create-issues/SKILL.md)：要望・未完了タスクを調べ、受け入れ条件・検証方法・依存関係付きのイシューを作成します。
- [develop-issue](.agents/skills/develop-issue/SKILL.md)：指定イシューから実装・検証し、進捗と残作業を記録します。

依頼例：

```text
$create-issues 未完了のMVPを優先順にイシュー化してください。まずローカル下書きとして保存してください。
$create-issues 下書きを確認し、対象リポジトリのGitHubにイシューを作成してください。
$develop-issue docs/issues/LOCAL-001.md を実装・検証してください。
$develop-issue イシュー #12 を実装・検証してください。
```

GitHubを使う場合は、対象リポジトリへのアクセスとイシュー読み書き権限が必要です。接続できない場合は `docs/issues/` に下書きを残します。下書きのLOCAL番号とGitHub番号は別です。起票後はURLまたはローカルパスを実装担当AIに渡してください。

スキルが候補に出ない場合は、新しいチャットでこのリポジトリを開くか、上記SKILL.mdのパスを指定して実行を依頼してください。この仕組みは依頼時にAIが進める手順です。常駐監視・自動起動のCIは未設定です。
