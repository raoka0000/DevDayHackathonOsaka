# FluidR3_GM 音源素材

MIDI音源連携のために保存した素材。MIDI専用画面から6音色を選択し、Playerのサンプル再生で利用する。

- 取得日: 2026-11-07
- 配布元: https://github.com/gleitz/midi-js-soundfonts
- 固定リビジョン: 044fab8e1456bfafc5776e86dfd6bb8697149aef
- 原音源: FluidR3_GM（Frank Wen）。ブラウザ向け変換・配布: Benjamin Gleitzman / midi-js-soundfonts。
- 加工: なし。配布元のMP3埋め込みJavaScriptをそのまま保存。
- 音源のライセンス: 配布元READMEのFluid Soundfont欄に従いCC BY 3.0 US。LICENSE-SAMPLES.htmlに規約を保存。
- 変換コード等のライセンス: LICENSE-CODE.txt（MIT）。音源の利用条件とは別。
- 配布元の説明: UPSTREAM-README.md。
- 各ファイルの取得URL・サイズ・SHA-256・収録サンプル数: manifest.json。

| ファイル名（-mp3.js） | 内容 | GMプログラム（0始まり） |
| --- | --- | --- |
| acoustic_grand_piano | グランドピアノ | 0 |
| acoustic_guitar_nylon | ナイロン弦ギター | 24 |
| string_ensemble_1 | ストリングス | 48 |
| taiko_drum | 太鼓 | 116 |
| melodic_tom | メロディックタム | 117 |
| synth_drum | シンセドラム | 118 |

## 再生接続の注意

これらはSF2やMIDIファイルではなく、各音高のMP3をBase64で埋め込んだMIDI.js形式の音源バンク。src/soundfont.tsでデータ部分を検証してAudioBufferに変換する。JavaScriptは実行せず、必要な音色・音高だけ読み込む。

打楽器3音色は音高付きのGM楽器で、チャンネル10の標準ドラムキットではない。キック・スネア・ハイハット一式は含まない。通常のドラムキットが必要になったら、別途素材とGMドラムノートの対応を用意する。

公開時は音源の作者・配布元・ライセンスへの案内を利用者が確認できるようにする。取得・Base64データに加え、ローカルブラウザで6音色のデコード・再生開始を確認。音声の実聴・外部DAW・公開環境は未確認。
