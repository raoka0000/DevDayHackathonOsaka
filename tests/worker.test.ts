import test from 'node:test';
import assert from 'node:assert/strict';
import { handleImageAnalysis } from '../src/worker.ts';
import { midiFor, notesFor, sample } from '../src/music.ts';

const png = Uint8Array.from([137,80,78,71,13,10,26,10,...Array(20).fill(0)]);
function makeForm(images: { bytes: Uint8Array; type: string }[], context?: string) {
  const form = new FormData();
  for (const image of images) form.append('images', new File([image.bytes], 'image.png', { type: image.type }));
  if (context !== undefined) form.append('context', context);
  return new Request('https://example.com/api/image-analysis', { method: 'POST', body: form });
}
test('複数写真を一度の分析に渡し、既存Song形式を返す', async () => {
  let calls = 0;
  const analyze = async (images: unknown[]) => {
    calls++;
    assert.equal(images.length, 3);
    return { ok: true as const, analysis: { version: 1 as const, moods: ['穏やか'], description: '柔らかな印象' }, song: sample };
  };
  const res = await handleImageAnalysis(makeForm(Array(3).fill({ bytes: png, type: 'image/png' })), 'dummy', analyze);
  assert.equal(res.status, 200);
  const song = (await res.json()).song;
  assert.deepEqual(song, sample);
  assert.ok(notesFor(song).length > 0);
  assert.equal(new TextDecoder().decode(midiFor(song).slice(0, 4)), 'MThd');
  assert.equal(calls, 1);
});
test('枚数、形式の偽装、テキスト超過を外部呼び出し前に拒否する', async () => {
  let calls = 0;
  const analyze = async () => { calls++; return { ok: false as const, reason: 'upstream' as const }; };
  for (const req of [makeForm([]), makeForm(Array(6).fill({ bytes: png, type: 'image/png' })),
    makeForm([{ bytes: png, type: 'image/jpeg' }]), makeForm([{ bytes: new Uint8Array([1,2,3]), type: 'image/png' }]),
    makeForm([{ bytes: png, type: 'image/png' }], 'あ'.repeat(201))]) {
    assert.equal((await handleImageAnalysis(req, 'dummy', analyze)).status, 400);
  }
  assert.equal(calls, 0);
});
test('上流障害やキー未設定を成功と扱わない', async () => {
  const req = () => makeForm([{ bytes: png, type: 'image/png' }]);
  assert.equal((await handleImageAnalysis(req(), undefined)).status, 503);
  assert.equal((await handleImageAnalysis(req(), 'dummy', async () => ({ ok: false, reason: 'timeout' }))).status, 504);
});
