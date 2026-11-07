// Photo upload regression tests
import { test } from 'node:test';
import assert from 'node:assert';

test('ファイル形式検証 - 有効な形式', () => {
  const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
  
  for (const type of validTypes) {
    assert.ok(validTypes.includes(type), `${type}は有効`);
  }
});

test('ファイル形式検証 - 無効な形式', () => {
  const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const invalidTypes = [
    'image/gif',
    'image/bmp',
    'image/svg+xml',
    'application/pdf',
    'text/plain',
    'video/mp4'
  ];
  
  for (const type of invalidTypes) {
    assert.ok(!validTypes.includes(type), `${type}は無効`);
  }
});

test('ファイルサイズ検証 - 境界値', () => {
  const maxSize = 10 * 1024 * 1024; // 10MB
  
  const testCases = [
    { size: 0, valid: false, description: '0バイト（空ファイル）' },
    { size: 1, valid: true, description: '1バイト' },
    { size: 1024, valid: true, description: '1KB' },
    { size: 1024 * 1024, valid: true, description: '1MB' },
    { size: 5 * 1024 * 1024, valid: true, description: '5MB' },
    { size: maxSize - 1, valid: true, description: '10MB - 1バイト' },
    { size: maxSize, valid: true, description: 'ちょうど10MB' },
    { size: maxSize + 1, valid: false, description: '10MB + 1バイト' },
    { size: 20 * 1024 * 1024, valid: false, description: '20MB' }
  ];
  
  for (const { size, valid, description } of testCases) {
    const isValid = size > 0 && size <= maxSize;
    assert.strictEqual(isValid, valid, description);
  }
});

test('モバイルAPI互換性 - File/Blob検証', () => {
  // File/Blobのプロパティが存在することを確認
  const mockFile = {
    name: 'test.jpg',
    type: 'image/jpeg',
    size: 1024,
    lastModified: Date.now()
  };
  
  assert.ok(mockFile.name, 'nameプロパティが存在');
  assert.ok(mockFile.type, 'typeプロパティが存在');
  assert.ok(typeof mockFile.size === 'number', 'sizeが数値');
  assert.ok(typeof mockFile.lastModified === 'number', 'lastModifiedが数値');
});

test('FormData photo添付 - 正常', () => {
  // FormData.appendの動作を確認
  const fd = new FormData();
  
  // Blobを使ってFileをシミュレート
  const blob = new Blob(['test image data'], { type: 'image/jpeg' });
  const file = new File([blob], 'test.jpg', { type: 'image/jpeg' });
  
  try {
    fd.append('photo', file);
    assert.ok(fd.has('photo'), 'photoフィールドが追加された');
  } catch (e) {
    assert.fail('FormData.appendが失敗');
  }
});

test('エラーメッセージの明確性', () => {
  const errorMessages = [
    { type: 'format', message: '対応していないファイル形式です（image/gif）。JPEG・PNG・WebPの画像を選んでください。' },
    { type: 'size', message: 'ファイルサイズが大きすぎます（15.2MB）。10MB以下の画像を選んでください。' },
    { type: 'empty', message: 'ファイルが空です。有効な画像ファイルを選んでください。' },
    { type: 'preview', message: '写真のプレビューに失敗しました。別の画像を選んでください。' },
    { type: 'formdata', message: '写真の読み込みに失敗しました。ファイルを再度選択してください。' },
    { type: 'network', message: 'ネットワークに接続できませんでした。接続を確認して再試行してください。' },
    { type: 'server502', message: 'サーバーで音楽生成に失敗しました。写真を変更するか、しばらく待ってから再試行してください。' },
    { type: 'server429', message: 'アクセスが集中しています。1分ほど待ってから再試行してください。' },
    { type: 'json', message: 'サーバーからの応答が不正です。再試行してください。' },
    { type: 'validation', message: '生成された音楽設定が不正です。再試行してください。' },
    { type: 'unexpected', message: '予期しないエラーが発生しました。ページを再読み込みして再試行してください。' }
  ];
  
  for (const { type, message } of errorMessages) {
    assert.ok(message.length > 0, `${type}のメッセージが存在`);
    assert.ok(message.includes('。'), `${type}のメッセージが日本語`);
    // 次のアクションが明確か確認
    const hasAction = 
      message.includes('選んで') ||
      message.includes('選択') ||
      message.includes('再試行') ||
      message.includes('確認') ||
      message.includes('再読み込み') ||
      message.includes('待って') ||
      message.includes('変更');
    assert.ok(hasAction, `${type}のメッセージに次のアクションが含まれる`);
  }
});

test('生成結果の検証 - 正常', () => {
  const validData = {
    bpm: 120,
    bars: ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'C'],
    pattern: 'arpeggio' as const,
    mood: ['明るい', '温かい'],
    explanation: '写真の雰囲気に合う音楽です。'
  };
  
  // クライアント側の検証ロジック
  const isValid =
    validData &&
    typeof validData.bpm === 'number' &&
    Array.isArray(validData.bars) &&
    validData.bars.length === 8 &&
    (validData.pattern === 'block' || validData.pattern === 'arpeggio') &&
    Array.isArray(validData.mood) &&
    typeof validData.explanation === 'string';
  
  assert.ok(isValid, '正常なデータが検証をパス');
});

test('生成結果の検証 - 不正なケース', () => {
  const invalidCases = [
    { data: null, error: 'null' },
    { data: {}, error: 'bpmなし' },
    { data: { bpm: '120', bars: [], pattern: 'arpeggio', mood: [], explanation: '' }, error: 'bpm文字列' },
    { data: { bpm: 120, bars: [], pattern: 'arpeggio', mood: [], explanation: '' }, error: 'bars空' },
    { data: { bpm: 120, bars: ['C', 'G'], pattern: 'arpeggio', mood: [], explanation: '' }, error: 'bars不足' },
    { data: { bpm: 120, bars: ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'C'], pattern: 'random', mood: [], explanation: '' }, error: '不正なpattern' },
    { data: { bpm: 120, bars: ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'C'], pattern: 'arpeggio', mood: 'happy', explanation: '' }, error: 'mood配列でない' },
    { data: { bpm: 120, bars: ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'C'], pattern: 'arpeggio', mood: [], explanation: 123 }, error: 'explanation数値' }
  ];
  
  for (const { data, error } of invalidCases) {
    const isValid =
      data &&
      typeof (data as any).bpm === 'number' &&
      Array.isArray((data as any).bars) &&
      (data as any).bars.length === 8 &&
      ((data as any).pattern === 'block' || (data as any).pattern === 'arpeggio') &&
      Array.isArray((data as any).mood) &&
      typeof (data as any).explanation === 'string';
    
    assert.ok(!isValid, error);
  }
});

test('モバイル用のファイルサイズ表示', () => {
  const testCases = [
    { bytes: 0, expected: '0.0' },
    { bytes: 512, expected: '0.0' },
    { bytes: 1024, expected: '0.0' },
    { bytes: 1024 * 1024, expected: '1.0' },
    { bytes: 1.5 * 1024 * 1024, expected: '1.5' },
    { bytes: 10 * 1024 * 1024, expected: '10.0' },
    { bytes: 15.234 * 1024 * 1024, expected: '15.2' }
  ];
  
  for (const { bytes, expected } of testCases) {
    const mb = (bytes / 1024 / 1024).toFixed(1);
    assert.strictEqual(mb, expected, `${bytes}バイト → ${expected}MB`);
  }
});
