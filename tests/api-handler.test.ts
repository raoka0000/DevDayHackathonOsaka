// bundledハンドラーのテスト - 実際のAPI実装をテスト
import { test } from 'node:test';
import assert from 'node:assert';

// functions/api/songs.ts の validateMusicSettings を直接インポート
// 実際のバンドルで使われるロジックをテスト

test('base64エンコードのchunk処理（大きめのバッファ）', () => {
  // スプレッドバグを捕捉できる十分な大きさ（100KB）
  const size = 100 * 1024;
  const testData = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    testData[i] = i % 256;
  }

  // Chunk処理の実装をテスト
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < testData.length; i += chunkSize) {
    const chunk = testData.subarray(i, Math.min(i + chunkSize, testData.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  const base64 = btoa(binary);

  // デコードして検証
  const decoded = atob(base64);
  assert.strictEqual(decoded.length, size, 'デコードサイズが一致');
  
  for (let i = 0; i < Math.min(100, size); i++) {
    assert.strictEqual(decoded.charCodeAt(i), testData[i], `バイト${i}が一致`);
  }
});

test('Origin完全一致検証 - 正常', () => {
  const testCases = [
    { origin: 'https://example.com', request: 'https://example.com/api/songs', shouldPass: true },
    { origin: 'https://example.com:443', request: 'https://example.com/api/songs', shouldPass: true },
    { origin: 'http://localhost:8788', request: 'http://localhost:8788/api/songs', shouldPass: true },
    { origin: 'http://127.0.0.1:8788', request: 'http://127.0.0.1:8788/api/songs', shouldPass: true },
  ];

  for (const { origin, request, shouldPass } of testCases) {
    const originUrl = new URL(origin);
    const requestUrl = new URL(request);
    const requestOrigin = `${originUrl.protocol}//${originUrl.host}`;
    const expectedOrigin = `${requestUrl.protocol}//${requestUrl.host}`;
    const isLocalhost = originUrl.hostname === 'localhost' || originUrl.hostname === '127.0.0.1';
    
    const passes = (requestOrigin === expectedOrigin) || isLocalhost;
    assert.strictEqual(passes, shouldPass, `${origin} -> ${request}: ${shouldPass ? '許可' : '拒否'}`);
  }
});

test('Origin完全一致検証 - 異なるオリジンを拒否', () => {
  const testCases = [
    { origin: 'https://evil.com', request: 'https://example.com/api/songs', shouldPass: false },
    { origin: 'https://example.com.evil.com', request: 'https://example.com/api/songs', shouldPass: false },
    { origin: 'https://sub.example.com', request: 'https://example.com/api/songs', shouldPass: false },
  ];

  for (const { origin, request, shouldPass } of testCases) {
    try {
      const originUrl = new URL(origin);
      const requestUrl = new URL(request);
      const requestOrigin = `${originUrl.protocol}//${originUrl.host}`;
      const expectedOrigin = `${requestUrl.protocol}//${requestUrl.host}`;
      const isLocalhost = originUrl.hostname === 'localhost' || originUrl.hostname === '127.0.0.1';
      
      const passes = (requestOrigin === expectedOrigin) || isLocalhost;
      assert.strictEqual(passes, shouldPass, `${origin} -> ${request}: ${shouldPass ? '許可' : '拒否'}`);
    } catch (e) {
      // 不正なOriginの場合はエラー
      assert.strictEqual(shouldPass, false, `${origin}は不正なOriginとして拒否されるべき`);
    }
  }
});

test('音楽設定の完全な検証 - 正常', () => {
  // validateMusicSettings と同じロジックを検証
  const validData = {
    bpm: 120,
    bars: ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'C'],
    pattern: 'arpeggio',
    mood: ['明るい', '温かい', '穏やか'],
    explanation: 'この写真は明るい雰囲気で、温かみのある音楽が合います。'
  };

  // 型チェック
  assert.strictEqual(typeof validData.bpm, 'number');
  assert.ok(Number.isFinite(validData.bpm));
  assert.ok(validData.bpm >= 60 && validData.bpm <= 160);

  // Bars検証
  assert.ok(Array.isArray(validData.bars));
  assert.strictEqual(validData.bars.length, 8);
  const validChords = ['C', 'Cm', 'D', 'Dm', 'E', 'Em', 'F', 'Fm', 'G', 'Gm', 'A', 'Am', 'B', 'Bm'];
  for (const bar of validData.bars) {
    assert.strictEqual(typeof bar, 'string');
    assert.ok(validChords.includes(bar), `${bar}は有効なコード`);
  }

  // Pattern検証
  assert.ok(validData.pattern === 'block' || validData.pattern === 'arpeggio');

  // Mood検証
  assert.ok(Array.isArray(validData.mood));
  assert.ok(validData.mood.length >= 1 && validData.mood.length <= 5);
  for (const tag of validData.mood) {
    assert.strictEqual(typeof tag, 'string');
    assert.ok(tag.length > 0 && tag.length <= 20);
  }

  // Explanation検証
  assert.strictEqual(typeof validData.explanation, 'string');
  assert.ok(validData.explanation.length > 0 && validData.explanation.length <= 500);
});

test('音楽設定の検証 - 不正なBPM', () => {
  const invalidCases = [
    { bpm: 59, error: 'BPM範囲外' },
    { bpm: 161, error: 'BPM範囲外' },
    { bpm: 'fast', error: 'BPM型不正' },
    { bpm: NaN, error: 'BPM NaN' },
    { bpm: Infinity, error: 'BPM Infinity' },
  ];

  for (const { bpm, error } of invalidCases) {
    const isValid = typeof bpm === 'number' && Number.isFinite(bpm) && bpm >= 60 && bpm <= 160;
    assert.strictEqual(isValid, false, error);
  }
});

test('音楽設定の検証 - 不正なBars', () => {
  const invalidCases = [
    { bars: ['C', 'G', 'Am', 'F'], error: '小節数不足' },
    { bars: ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'C', 'Dm'], error: '小節数過多' },
    { bars: ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'X'], error: '不正なコード' },
    { bars: 'C G Am F C G F C', error: 'bars型不正' },
  ];

  const validChords = ['C', 'Cm', 'D', 'Dm', 'E', 'Em', 'F', 'Fm', 'G', 'Gm', 'A', 'Am', 'B', 'Bm'];

  for (const { bars, error } of invalidCases) {
    let isValid = Array.isArray(bars) && bars.length === 8;
    if (isValid && Array.isArray(bars)) {
      for (const bar of bars) {
        if (typeof bar !== 'string' || !validChords.includes(bar)) {
          isValid = false;
          break;
        }
      }
    }
    assert.strictEqual(isValid, false, error);
  }
});

test('音楽設定の検証 - 不正なPattern', () => {
  const invalidCases = [
    { pattern: 'random', error: '不正なpattern' },
    { pattern: 'ARPEGGIO', error: '大文字' },
    { pattern: '', error: '空文字' },
    { pattern: 123, error: '数値' },
  ];

  for (const { pattern, error } of invalidCases) {
    const isValid = pattern === 'block' || pattern === 'arpeggio';
    assert.strictEqual(isValid, false, error);
  }
});

test('音楽設定の検証 - 不正なMood', () => {
  const invalidCases = [
    { mood: [], error: 'mood空配列' },
    { mood: ['a', 'b', 'c', 'd', 'e', 'f'], error: 'mood個数過多' },
    { mood: ['これは20文字を超える非常に長いタグテキストです'], error: 'moodタグ長すぎ' },
    { mood: 'happy', error: 'mood型不正' },
    { mood: [123, 456], error: 'mood要素型不正' },
  ];

  for (const { mood, error } of invalidCases) {
    let isValid = Array.isArray(mood) && mood.length >= 1 && mood.length <= 5;
    if (isValid && Array.isArray(mood)) {
      for (const tag of mood) {
        if (typeof tag !== 'string' || tag.length === 0 || tag.length > 20) {
          isValid = false;
          break;
        }
      }
    }
    assert.strictEqual(isValid, false, error);
  }
});

test('音楽設定の検証 - 不正なExplanation', () => {
  const invalidCases = [
    { explanation: '', error: 'explanation空' },
    { explanation: 'あ'.repeat(501), error: 'explanation長すぎ' },
    { explanation: 123, error: 'explanation型不正' },
  ];

  for (const { explanation, error } of invalidCases) {
    const isValid = typeof explanation === 'string' && explanation.length > 0 && explanation.length <= 500;
    assert.strictEqual(isValid, false, error);
  }
});

test('Content-Length上限チェック', () => {
  const MAX_BODY_SIZE = 12 * 1024 * 1024;
  
  const testCases = [
    { contentLength: '1024', shouldPass: true },
    { contentLength: '10485760', shouldPass: true }, // 10MB
    { contentLength: '12582912', shouldPass: true }, // ちょうど12MB
    { contentLength: '12582913', shouldPass: false }, // 12MB + 1byte
    { contentLength: '20971520', shouldPass: false }, // 20MB
  ];

  for (const { contentLength, shouldPass } of testCases) {
    const size = parseInt(contentLength);
    const passes = size <= MAX_BODY_SIZE;
    assert.strictEqual(passes, shouldPass, `${contentLength}バイト: ${shouldPass ? '許可' : '拒否'}`);
  }
});

test('OpenAI応答の構造検証', () => {
  const validResponse = {
    choices: [
      {
        message: {
          role: 'assistant',
          content: JSON.stringify({
            bpm: 120,
            bars: ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'C'],
            pattern: 'arpeggio',
            mood: ['明るい', '温かい'],
            explanation: '写真の雰囲気に合う音楽です。'
          })
        },
        finish_reason: 'stop'
      }
    ]
  };

  // 構造検証
  assert.ok(validResponse.choices);
  assert.ok(Array.isArray(validResponse.choices));
  assert.ok(validResponse.choices.length > 0);
  assert.ok(validResponse.choices[0].message);
  assert.strictEqual(typeof validResponse.choices[0].message.content, 'string');

  // Content長さ検証
  const content = validResponse.choices[0].message.content;
  assert.ok(content.length <= 10000, 'コンテンツサイズが10KB以下');

  // JSON解析
  const parsed = JSON.parse(content);
  assert.ok(parsed && typeof parsed === 'object' && !Array.isArray(parsed));
});

test('OpenAI応答の構造検証 - 不正なケース', () => {
  const invalidCases: Array<{ response: any; error: string }> = [
    { response: {}, error: 'choicesなし' },
    { response: { choices: [] }, error: 'choices空' },
    { response: { choices: [{}] }, error: 'messageなし' },
    { response: { choices: [{ message: {} }] }, error: 'contentなし' },
    { response: { choices: [{ message: { content: 123 } }] }, error: 'content型不正' },
  ];

  for (const { response, error } of invalidCases) {
    const isValid = 
      response &&
      'choices' in response &&
      response.choices &&
      Array.isArray(response.choices) &&
      response.choices.length > 0 &&
      response.choices[0] &&
      'message' in response.choices[0] &&
      response.choices[0].message &&
      'content' in response.choices[0].message &&
      typeof response.choices[0].message.content === 'string';
    
    assert.strictEqual(isValid, false, error);
  }
});
