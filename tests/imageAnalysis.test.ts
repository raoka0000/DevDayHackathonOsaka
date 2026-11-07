import test from 'node:test';
import assert from 'node:assert/strict';
import { parseImageAnalysis } from '../src/imageAnalysis.ts';

test('分析結果は許可した項目だけを返し、元データと共有しない', () => {
  const input = { version: 1, moods: [' 温かい '], description: ' 光が柔らかい ', song: { bpm: 100 } };
  const result = parseImageAnalysis(input);
  assert.deepEqual(result, { version: 1, moods: ['温かい'], description: '光が柔らかい' });
  input.moods[0] = 'changed';
  assert.equal(result.moods[0], '温かい');
});

test('欠落、型違い、空、上限超過、不正なバージョンを拒否する', () => {
  const good = { version: 1, moods: ['穏やか'], description: '写真の印象' };
  for (const value of [null, [], {}, { ...good, version: 2 }, { ...good, moods: [] },
    { ...good, moods: Array(6).fill('穏やか') }, { ...good, moods: [4] },
    { ...good, moods: [' '.repeat(3)] }, { ...good, moods: ['あ'.repeat(31)] },
    { ...good, description: '' }, { ...good, description: 'あ'.repeat(201) }]) {
    assert.equal(parseImageAnalysis(value), null);
  }
  assert.ok(parseImageAnalysis({ ...good, moods: ['😀'.repeat(30)], description: 'あ'.repeat(200) }));
});
