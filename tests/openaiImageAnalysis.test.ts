import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeWithOpenAI } from '../src/openaiImageAnalysis.ts';

const bytes = new Uint8Array([1, 2, 3]);
const image = { bytes, mime: 'image/png' as const };
const response = (text: string, status = 'completed') => Response.json({ status, output: [{ type: 'message', content: [{ type: 'output_text', text }] }] });
const song = { bpm: 90, pattern: 'arpeggio', bars: ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'C'] };
const valid = JSON.stringify({ moods: ['穏やか'], description: '柔らかな印象', song });

test('画像と設定をResponses APIへ送り、検証済みの印象だけ返す', async () => {
  const mock = async (url: string | URL | Request, init?: RequestInit) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    const body = JSON.parse(init!.body as string);
    assert.equal(body.model, 'gpt-6-luna');
    assert.equal(body.store, false);
    assert.equal(body.input[0].content[1].image_url, 'data:image/png;base64,AQID');
    assert.equal(body.input[0].content.length, 4);
    assert.equal(body.text.format.strict, true);
    return response(valid);
  };
  assert.deepEqual(await analyzeWithOpenAI([image, image, image], '', 'dummy', mock as typeof fetch),
    { ok: true, analysis: { version: 1, moods: ['穏やか'], description: '柔らかな印象' }, song });
});

test('認証なし、拒否、未完了、破損、範囲外の応答を拒否する', async () => {
  assert.deepEqual(await analyzeWithOpenAI([image], '', undefined), { ok: false, reason: 'configuration' });
  for (const result of [response('bad'), response(valid, 'incomplete'), response('{"moods":[],"description":"x"}'),
    response(JSON.stringify({ moods: ['穏やか'], description: '印象', song: { ...song, bars: ['C'] } })),
    response(JSON.stringify({ moods: ['穏やか'], description: '印象', song: { ...song, bpm: 161 } })),
    response(JSON.stringify({ moods: ['穏やか'], description: '印象', song: { ...song, bars: Array(8).fill('F#') } })),
    new Response('not json', { status: 200 }),
    Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'no' }] }] })]) {
    const outcome = await analyzeWithOpenAI([image], '', 'dummy', (async () => result) as typeof fetch);
    assert.deepEqual(outcome, { ok: false, reason: 'invalid_response' });
  }
  assert.deepEqual(await analyzeWithOpenAI([image], '', 'dummy', (async () => new Response('', { status: 429 })) as typeof fetch), { ok: false, reason: 'upstream' });
});

test('タイムアウトで通信を中断し、内容を漏らさない', async () => {
  const pending = (_url: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    init!.signal!.addEventListener('abort', () => reject(new Error('secret')), { once: true });
  });
  assert.deepEqual(await analyzeWithOpenAI([image], '', 'dummy', pending as typeof fetch, 5), { ok: false, reason: 'timeout' });
});

test('画像0枚と6枚を外部送信前に拒否する', async () => {
  let called = false;
  const mock = (async () => { called = true; return response(valid); }) as typeof fetch;
  for (const images of [[], Array(6).fill(image)]) {
    assert.deepEqual(await analyzeWithOpenAI(images, '', 'dummy', mock), { ok: false, reason: 'invalid_input' });
  }
  assert.equal(called, false);
});
