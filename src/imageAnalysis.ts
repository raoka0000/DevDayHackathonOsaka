import { instruments } from './instruments';
import { chords, validateSong, type Chord, type Song } from './music';

/** 画像分析と音楽生成の間で使う暫定契約。Songは含めない。 */
export type ImageAnalysis = {
  version: 1;
  moods: string[];
  description: string;
};

function validText(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && Array.from(value).length <= max;
}

/** 外部AIの値を信頼せず、必要な項目だけを新しいオブジェクトとして返す。 */
export function parseImageAnalysis(value: unknown): ImageAnalysis | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (candidate.version !== 1 || !Array.isArray(candidate.moods) ||
      candidate.moods.length < 1 || candidate.moods.length > 5 ||
      !candidate.moods.every((mood: unknown) => validText(mood, 30)) ||
      !validText(candidate.description, 200)) return null;
  return {
    version: 1,
    moods: candidate.moods.map((mood: string) => mood.trim()),
    description: candidate.description.trim(),
  };
}

/** サーバー応答をunknownから検証する。 */
export function parseAnalysisSong(value: unknown): Song | null {
  if (!value || typeof value !== 'object' || !('bpm' in value) || !('pattern' in value) || !('bars' in value)) return null;
  const { bpm, pattern, bars } = value;
  if (typeof bpm !== 'number' || (pattern !== 'block' && pattern !== 'arpeggio') || !Array.isArray(bars)) return null;
  const validBars = bars.filter((bar: unknown): bar is Chord => chords.some(chord => chord === bar));
  if (validBars.length !== bars.length) return null;
  const song: Song = { bpm, pattern, bars: validBars };
  if ('sections' in value) {
    if (!Array.isArray(value.sections)) return null;
    song.sections = [];
    for (const section of value.sections) {
      if (!section || typeof section !== 'object' || !('startBar' in section) || !('bpm' in section) || !('pattern' in section) || !('accompaniment' in section) || !('melody' in section) || !('bass' in section)) return null;
      const accompaniment = instruments.find(item => item.id === section.accompaniment)?.id;
      const melody = instruments.find(item => item.id === section.melody)?.id;
      const bass = instruments.find(item => item.id === section.bass)?.id;
      if (typeof section.startBar !== 'number' || typeof section.bpm !== 'number' || (section.pattern !== 'block' && section.pattern !== 'arpeggio') || !accompaniment || !melody || !bass) return null;
      song.sections.push({startBar:section.startBar,bpm:section.bpm,pattern:section.pattern,accompaniment,melody,bass});
    }
  }
  try { validateSong(song); return song; } catch { return null; }
}

export function imageAnalysisError(status: number, body: unknown): string {
  const code = body && typeof body === 'object' && 'error' in body ? body.error : undefined;
  switch (code) {
    case 'api_unavailable': return '写真分析APIへ接続できません。npm run devを再起動し、APIの起動エラーを確認してください。';
    case 'configuration': return '写真分析サーバーのOPENAI_API_KEYが未設定です。ローカルは.dev.vars、本番はWorkerの秘密情報を設定してください。';
    case 'invalid_image': return '画像の内容と形式が一致しないか、対応していません。JPEG・PNG・WebPとして保存し直して選んでください。';
    case 'invalid_input': return '写真の入力が不正です。JPEG・PNG・WebPを1〜5枚、各10 MiB以下・合計20 MiB以下で選び直してください。';
    case 'too_large': return '画像の容量が上限を超えています。各10 MiB以下・合計20 MiB以下にしてください。';
    case 'timeout': return '写真分析が時間切れになりました。画像の枚数や容量を減らして再試行してください。';
    case 'upstream': return 'OpenAIへのリクエストが失敗しました。サーバーのAPIキー・課金／利用枠・モデルへのアクセス・接続を確認してください。';
    case 'invalid_response': return 'AIの応答が必要な形式を満たしていません。別の写真で試すか、再試行してください。';
    default: return `写真分析APIがエラーを返しました（HTTP ${status}）。Workerの起動状態と接続先を確認してください。`;
  }
}
