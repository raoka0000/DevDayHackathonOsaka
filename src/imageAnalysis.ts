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
