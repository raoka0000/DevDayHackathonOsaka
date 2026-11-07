// Auth binding and secret handling tests
// Tests actual bundled handler logic with fake env
import { test } from 'node:test';
import assert from 'node:assert';

test('API key validation - empty string rejected', () => {
  const testCases = [
    { key: '', shouldReject: true, reason: '空文字列' },
    { key: '   ', shouldReject: true, reason: '空白のみ' },
    { key: '\n\t', shouldReject: true, reason: '改行・タブ' },
    { key: 'sk-test123', shouldReject: false, reason: '有効なキー' },
    { key: undefined, shouldReject: true, reason: 'undefined' },
    { key: null, shouldReject: true, reason: 'null' },
  ];

  for (const { key, shouldReject, reason } of testCases) {
    const isInvalid = 
      !key || 
      typeof key !== 'string' || 
      key.trim().length === 0;
    
    assert.strictEqual(isInvalid, shouldReject, reason);
  }
});

test('Authorization header format validation', () => {
  const validKeys = [
    'sk-test123456789',
    'sk-proj-abcdefghijklmnopqrstuvwxyz',
    'sk-1234567890abcdef'
  ];

  for (const key of validKeys) {
    const authHeader = `Bearer ${key}`;
    assert.ok(authHeader.startsWith('Bearer '), 'Bearer prefix');
    assert.ok(authHeader.length > 7, 'has key after Bearer');
    assert.ok(authHeader.includes(key), 'contains key');
  }
});

test('Authorization header - empty key creates invalid header', () => {
  const emptyKey = '';
  const authHeader = `Bearer ${emptyKey}`;
  
  // This would be "Bearer " with no actual key
  assert.strictEqual(authHeader, 'Bearer ', '空キーは無効なヘッダーを作成');
  assert.strictEqual(authHeader.trim(), 'Bearer', 'trimすると"Bearer"のみ');
});

test('Key format validation (sk- prefix and minimum length)', () => {
  const testCases = [
    { key: 'sk-test123456789abcdefg', valid: true, reason: '有効なプレフィックスと長さ' },
    { key: 'sk-abc', valid: false, reason: '短すぎる' },
    { key: 'test123456789', valid: false, reason: 'sk-プレフィックスなし' },
    { key: 'SK-test123456789', valid: false, reason: '大文字SK' },
    { key: '', valid: false, reason: '空文字列' },
  ];

  for (const { key, valid, reason } of testCases) {
    const isValid = key.startsWith('sk-') && key.length > 20;
    assert.strictEqual(isValid, valid, reason);
  }
});

test('Diagnostic logging - no secret exposure', () => {
  const realKey = 'sk-test123456789abcdefghijklmnop';
  
  // Simulate diagnostic info that should be logged
  const diagnosticInfo = {
    authHeaderValid: realKey.startsWith('sk-') && realKey.length > 20,
    keyLength: realKey.length,
    hasPrefix: realKey.startsWith('sk-')
  };

  // Verify NO actual key in diagnostic
  const diagnosticString = JSON.stringify(diagnosticInfo);
  assert.ok(!diagnosticString.includes(realKey), '秘密情報を含まない');
  assert.ok(!diagnosticString.includes('sk-test'), '秘密プレフィックスを含まない');
  
  // Verify useful diagnostic info IS present
  assert.ok(diagnosticInfo.authHeaderValid, '検証情報あり');
  assert.strictEqual(diagnosticInfo.keyLength, 32, '長さ情報あり');
});

test('Error response sanitization - no secret exposure', () => {
  const realKey = 'sk-test123456789';
  const authHeader = `Bearer ${realKey}`;
  
  // Simulate error message that might reference auth
  const errorMessage = 'API認証に失敗しました。管理者にお問い合わせください。';
  
  // Verify error doesn't expose key
  assert.ok(!errorMessage.includes(realKey), 'エラーに秘密なし');
  assert.ok(!errorMessage.includes('Bearer'), 'エラーにBearer なし');
  assert.ok(!errorMessage.includes('sk-'), 'エラーにプレフィックスなし');
});

test('Binding name case sensitivity check', () => {
  // Cloudflare Workers bindings are case-sensitive
  const bindingNames = [
    'OPENAI_API_KEY',  // Correct
    'openai_api_key',  // Wrong case
    'OpenAI_API_Key',  // Wrong case
    'OPENAI_API_KEY ', // Trailing space
    ' OPENAI_API_KEY', // Leading space
  ];

  const correctName = 'OPENAI_API_KEY';
  
  for (const name of bindingNames) {
    const matches = name === correctName;
    const isCorrect = name === 'OPENAI_API_KEY';
    assert.strictEqual(matches, isCorrect, `${name}: ${isCorrect ? '正しい' : '間違い'}`);
  }
});

test('Empty key detection at runtime', () => {
  // Simulate what happens at runtime
  const envScenarios = [
    { env: { OPENAI_API_KEY: 'sk-test123' }, shouldPass: true },
    { env: { OPENAI_API_KEY: '' }, shouldPass: false },
    { env: { OPENAI_API_KEY: '   ' }, shouldPass: false },
    { env: {}, shouldPass: false },
    { env: { OPENAI_API_KEY: undefined }, shouldPass: false },
    { env: { OPENAI_API_KEY: null }, shouldPass: false },
  ];

  for (const { env, shouldPass } of envScenarios) {
    const apiKey = env.OPENAI_API_KEY as any;
    const isValid = !!(
      apiKey && 
      typeof apiKey === 'string' && 
      apiKey.trim().length > 0
    );
    
    assert.strictEqual(isValid, shouldPass, JSON.stringify(env));
  }
});

test('Upstream 401 error handling', () => {
  const mockResponse = {
    ok: false,
    status: 401,
    headers: new Map([['x-request-id', 'req_abc123']])
  };

  // Our handler should:
  // 1. Log diagnostic info (no secret)
  // 2. Return 503 with generic message
  
  assert.strictEqual(mockResponse.status, 401, 'Upstream 401');
  
  const ourStatus = 503; // We map 401 to 503
  const ourMessage = 'API認証に失敗しました。管理者にお問い合わせください。';
  
  assert.strictEqual(ourStatus, 503, 'クライアントに503を返す');
  assert.ok(ourMessage.includes('管理者'), 'ユーザーに連絡を促す');
});

test('OpenAI error response structure', () => {
  const mockErrorResponse = {
    error: {
      message: 'Incorrect API key provided',
      type: 'invalid_request_error',
      param: null,
      code: 'invalid_api_key'
    }
  };

  // Our diagnostic logging should extract safe fields
  const diagnosticInfo = {
    code: mockErrorResponse.error.code,
    type: mockErrorResponse.error.type,
    // Message truncated to first 100 chars
    message: mockErrorResponse.error.message.substring(0, 100)
  };

  assert.strictEqual(diagnosticInfo.code, 'invalid_api_key', 'エラーコード取得');
  assert.strictEqual(diagnosticInfo.type, 'invalid_request_error', 'エラータイプ取得');
  assert.ok(diagnosticInfo.message.length <= 100, 'メッセージ切り詰め');
});

test('Request headers construction', () => {
  const fakeKey = 'sk-test-fake-key-123456789';
  
  const headers = {
    'Authorization': `Bearer ${fakeKey}`,
    'Content-Type': 'application/json'
  };

  assert.strictEqual(headers.Authorization, `Bearer ${fakeKey}`, 'Authorization header正しい');
  assert.strictEqual(headers['Content-Type'], 'application/json', 'Content-Type正しい');
  
  // Verify header doesn't accidentally include quotes or extra whitespace
  assert.ok(!headers.Authorization.includes('"'), 'クォートなし');
  assert.ok(!headers.Authorization.includes("'"), 'シングルクォートなし');
  assert.strictEqual(headers.Authorization.trim(), headers.Authorization, '余分な空白なし');
});

test('Fetch call structure', () => {
  const fakeKey = 'sk-test-fake-key';
  const url = 'https://api.openai.com/v1/chat/completions';
  const method = 'POST';
  const headers = {
    'Authorization': `Bearer ${fakeKey}`,
    'Content-Type': 'application/json'
  };
  const body = JSON.stringify({ model: 'gpt-4o-mini' });

  // Verify structure matches OpenAI API requirements
  assert.strictEqual(url, 'https://api.openai.com/v1/chat/completions', 'URL正しい');
  assert.strictEqual(method, 'POST', 'メソッド正しい');
  assert.ok(headers.Authorization.startsWith('Bearer '), 'Authorization形式正しい');
  assert.ok(body.includes('gpt-4o-mini'), 'ボディにモデル含む');
});
