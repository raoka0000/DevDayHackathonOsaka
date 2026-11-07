import test from 'node:test';
import assert from 'node:assert/strict';

// API検証ロジックのテスト（functions/api/songs.tsから抽出）
function validateMusicSettings(data: unknown): {
  bpm: number;
  bars: string[];
  pattern: 'block' | 'arpeggio';
  mood: string[];
  explanation: string;
} {
  if (!data || typeof data !== 'object') {
    throw new Error('応答形式が不正です。');
  }

  const obj = data as Record<string, unknown>;

  if (typeof obj.bpm !== 'number' || !Number.isFinite(obj.bpm)) {
    throw new Error('BPMの形式が不正です。');
  }
  if (obj.bpm < 60 || obj.bpm > 160) {
    throw new Error('BPMは60〜160の範囲で指定してください。');
  }

  if (!Array.isArray(obj.bars) || obj.bars.length !== 8) {
    throw new Error('8小節のコード進行が必要です。');
  }
  const validChords = ['C', 'Cm', 'D', 'Dm', 'E', 'Em', 'F', 'Fm', 'G', 'Gm', 'A', 'Am', 'B', 'Bm'];
  for (const bar of obj.bars) {
    if (typeof bar !== 'string' || !validChords.includes(bar)) {
      throw new Error(`不正なコード: ${bar}`);
    }
  }

  if (obj.pattern !== 'block' && obj.pattern !== 'arpeggio') {
    throw new Error('伴奏パターンはblockまたはarpeggioを指定してください。');
  }

  if (!Array.isArray(obj.mood)) {
    throw new Error('印象の形式が不正です。');
  }
  if (obj.mood.length === 0 || obj.mood.length > 5) {
    throw new Error('印象は1〜5個で指定してください。');
  }
  for (const tag of obj.mood) {
    if (typeof tag !== 'string' || tag.length === 0 || tag.length > 20) {
      throw new Error('印象タグの長さが不正です。');
    }
  }

  if (typeof obj.explanation !== 'string' || obj.explanation.length === 0) {
    throw new Error('説明が必要です。');
  }
  if (obj.explanation.length > 500) {
    throw new Error('説明が長すぎます。');
  }

  return {
    bpm: obj.bpm,
    bars: obj.bars as string[],
    pattern: obj.pattern as 'block' | 'arpeggio',
    mood: obj.mood as string[],
    explanation: obj.explanation
  };
}

test('正しい音楽設定を受け入れる', () => {
  const valid = {
    bpm: 100,
    bars: ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'C'],
    pattern: 'arpeggio',
    mood: ['明るい', '温かい'],
    explanation: 'やさしい雰囲気のコード進行です。'
  };
  
  const result = validateMusicSettings(valid);
  assert.equal(result.bpm, 100);
  assert.deepEqual(result.bars, ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'C']);
  assert.equal(result.pattern, 'arpeggio');
});

test('BPM範囲外・非有限値・小節数・不正コードを拒否する', () => {
  assert.throws(() => validateMusicSettings({ bpm: 59, bars: Array(8).fill('C'), pattern: 'block', mood: ['a'], explanation: 'x' }), /BPM/);
  assert.throws(() => validateMusicSettings({ bpm: 161, bars: Array(8).fill('C'), pattern: 'block', mood: ['a'], explanation: 'x' }), /BPM/);
  assert.throws(() => validateMusicSettings({ bpm: NaN, bars: Array(8).fill('C'), pattern: 'block', mood: ['a'], explanation: 'x' }), /BPM/);
  assert.throws(() => validateMusicSettings({ bpm: 100, bars: Array(7).fill('C'), pattern: 'block', mood: ['a'], explanation: 'x' }), /8小節/);
  assert.throws(() => validateMusicSettings({ bpm: 100, bars: Array(8).fill('X'), pattern: 'block', mood: ['a'], explanation: 'x' }), /不正なコード/);
});

test('不正なパターン・印象・説明を拒否する', () => {
  const base = { bpm: 100, bars: Array(8).fill('C') };
  assert.throws(() => validateMusicSettings({ ...base, pattern: 'invalid', mood: ['a'], explanation: 'x' }), /パターン/);
  assert.throws(() => validateMusicSettings({ ...base, pattern: 'block', mood: [], explanation: 'x' }), /印象/);
  assert.throws(() => validateMusicSettings({ ...base, pattern: 'block', mood: Array(6).fill('a'), explanation: 'x' }), /印象/);
  assert.throws(() => validateMusicSettings({ ...base, pattern: 'block', mood: ['a'], explanation: '' }), /説明/);
  assert.throws(() => validateMusicSettings({ ...base, pattern: 'block', mood: ['a'], explanation: 'x'.repeat(501) }), /長すぎ/);
});

test('null・undefined・非オブジェクトを拒否する', () => {
  assert.throws(() => validateMusicSettings(null), /形式/);
  assert.throws(() => validateMusicSettings(undefined), /形式/);
  assert.throws(() => validateMusicSettings('string'), /形式/);
  assert.throws(() => validateMusicSettings(123), /形式/);
});
