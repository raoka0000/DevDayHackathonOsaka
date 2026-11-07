// POST /api/songs - 写真から初期音楽設定を生成
// OpenAI Vision APIを使用してサーバー側で画像を分析
// レート制限とコスト制御を実装

interface Env {
  OPENAI_API_KEY?: string;
  ASSETS: Fetcher;
  RATE_LIMITER?: KVNamespace;
}

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_BODY_SIZE = 12 * 1024 * 1024; // 12MB (画像+メタデータ)
const REQUEST_TIMEOUT = 30000; // 30秒
const SUPPORTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// シンプルなインメモリレート制限（共有Workerでは制限あり）
const requestCounts = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60000; // 1分
const RATE_LIMIT_MAX = 3; // 1分あたり3リクエスト

// OpenAI APIレスポンスの型（構造検証用）
interface OpenAIMessage {
  role: string;
  content: unknown;
}

interface OpenAIChoice {
  message?: OpenAIMessage;
  finish_reason?: string;
}

interface OpenAIResponse {
  choices?: unknown;
  error?: { message?: string };
}

// 生成設定の検証（APIレスポンスから）
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

  // BPM検証
  if (typeof obj.bpm !== 'number' || !Number.isFinite(obj.bpm)) {
    throw new Error('BPMの形式が不正です。');
  }
  if (obj.bpm < 60 || obj.bpm > 160) {
    throw new Error('BPMは60〜160の範囲で指定してください。');
  }

  // Bars検証
  if (!Array.isArray(obj.bars) || obj.bars.length !== 8) {
    throw new Error('8小節のコード進行が必要です。');
  }
  const validChords = ['C', 'Cm', 'D', 'Dm', 'E', 'Em', 'F', 'Fm', 'G', 'Gm', 'A', 'Am', 'B', 'Bm'];
  for (const bar of obj.bars) {
    if (typeof bar !== 'string' || !validChords.includes(bar)) {
      throw new Error(`不正なコード: ${bar}`);
    }
  }

  // Pattern検証
  if (obj.pattern !== 'block' && obj.pattern !== 'arpeggio') {
    throw new Error('伴奏パターンはblockまたはarpeggioを指定してください。');
  }

  // Mood検証
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

  // Explanation検証
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

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  // APIキーの確認
  if (!env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is not configured');
    return new Response(
      JSON.stringify({ error: '音楽生成サービスが設定されていません。管理者にお問い合わせください。' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Origin検証（任意のCORS許可なし）
    const origin = request.headers.get('origin');
    const referer = request.headers.get('referer');
    const url = new URL(request.url);
    
    // 同一オリジンまたはリファラーチェック（本番では厳密化）
    if (origin && !origin.includes(url.hostname)) {
      // 開発時のlocalhostは許可
      if (!origin.includes('localhost') && !origin.includes('127.0.0.1')) {
        return new Response(
          JSON.stringify({ error: 'アクセスが拒否されました。' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Content-Length事前チェック（バッファリング前）
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_BODY_SIZE) {
      return new Response(
        JSON.stringify({ error: 'リクエストサイズが大きすぎます。' }),
        { status: 413, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // シンプルなレート制限（IP単位、共有Workerでは完全ではない）
    const clientIP = request.headers.get('cf-connecting-ip') || 'unknown';
    const now = Date.now();
    const rateLimitKey = clientIP;
    
    const record = requestCounts.get(rateLimitKey);
    if (record) {
      if (now < record.resetTime) {
        if (record.count >= RATE_LIMIT_MAX) {
          return new Response(
            JSON.stringify({ error: 'リクエストが多すぎます。1分後に再試行してください。' }),
            { 
              status: 429, 
              headers: { 
                'Content-Type': 'application/json',
                'Retry-After': Math.ceil((record.resetTime - now) / 1000).toString()
              } 
            }
          );
        }
        record.count++;
      } else {
        requestCounts.set(rateLimitKey, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
      }
    } else {
      requestCounts.set(rateLimitKey, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    }

    // 古いエントリーのクリーンアップ（メモリ管理）
    if (requestCounts.size > 10000) {
      for (const [key, value] of requestCounts.entries()) {
        if (now > value.resetTime + 60000) {
          requestCounts.delete(key);
        }
      }
    }
    // Content-Type確認
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.startsWith('multipart/form-data')) {
      return new Response(
        JSON.stringify({ error: 'multipart/form-dataで送信してください。' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // FormData解析
    const formData = await request.formData();
    const photoFile = formData.get('photo');
    const context_text = formData.get('context');

    if (!photoFile || !(photoFile instanceof File)) {
      return new Response(
        JSON.stringify({ error: '写真を選択してください。' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // MIME type検証
    if (!SUPPORTED_MIME_TYPES.includes(photoFile.type)) {
      return new Response(
        JSON.stringify({ error: 'JPEG、PNG、WebP形式の画像を選択してください。' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // サイズ検証
    if (photoFile.size > MAX_IMAGE_SIZE) {
      return new Response(
        JSON.stringify({ error: '画像サイズは10MB以下にしてください。' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 画像をbase64エンコード
    const arrayBuffer = await photoFile.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    const dataUrl = `data:${photoFile.type};base64,${base64}`;

    // OpenAI Vision API呼び出し
    const openaiPayload = {
      model: 'gpt-4o-mini', // 小型のvision対応モデル
      messages: [
        {
          role: 'system',
          content: 'あなたは写真から音楽の雰囲気を提案する専門家です。写真の印象を分析し、それに合う音楽の設定をJSON形式で返してください。'
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `この写真に合う音楽の設定を提案してください。${context_text ? `\n希望: ${context_text}` : ''}\n\n以下のJSON形式で返してください:\n{\n  "bpm": 60〜160の整数,\n  "bars": ["C", "G", "Am", "F", "C", "G", "F", "C"], // 8小節のコード進行（C, Cm, D, Dm, E, Em, F, Fm, G, Gm, A, Am, B, Bmから選択）\n  "pattern": "arpeggio" または "block",\n  "mood": ["明るい", "温かい", "穏やか"], // 1〜5個の短い印象タグ\n  "explanation": "この写真は..." // 200文字以内の提案理由\n}`
            },
            {
              type: 'image_url',
              image_url: { url: dataUrl, detail: 'low' }
            }
          ]
        }
      ],
      response_format: { type: 'json_object' },
      max_tokens: 500,
      temperature: 0.7
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(openaiPayload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('OpenAI API error:', openaiResponse.status, errorText);
      
      if (openaiResponse.status === 401) {
        return new Response(
          JSON.stringify({ error: 'API認証に失敗しました。管理者にお問い合わせください。' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      if (openaiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: '現在アクセスが集中しています。しばらく待ってから再試行してください。' }),
          { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '60' } }
        );
      }

      return new Response(
        JSON.stringify({ error: '音楽の生成に失敗しました。しばらく待ってから再試行してください。' }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const responseData = await openaiResponse.json() as OpenAIResponse;

    // レスポンス構造検証
    if (!responseData.choices || !Array.isArray(responseData.choices) || responseData.choices.length === 0) {
      console.error('Invalid OpenAI response structure');
      return new Response(
        JSON.stringify({ error: '応答の解析に失敗しました。再試行してください。' }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const choice = responseData.choices[0] as OpenAIChoice;
    if (!choice.message || typeof choice.message.content !== 'string') {
      console.error('Invalid message content');
      return new Response(
        JSON.stringify({ error: '応答の解析に失敗しました。再試行してください。' }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // コンテンツサイズ検証
    if (choice.message.content.length > 10000) {
      console.error('Response content too large');
      return new Response(
        JSON.stringify({ error: '応答が大きすぎます。再試行してください。' }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // JSON解析
    let musicData: unknown;
    try {
      musicData = JSON.parse(choice.message.content);
    } catch (parseError) {
      console.error('JSON parse error');
      return new Response(
        JSON.stringify({ error: '応答の形式が不正です。再試行してください。' }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 基本的な型チェック
    if (!musicData || typeof musicData !== 'object' || Array.isArray(musicData)) {
      console.error('Invalid music data type');
      return new Response(
        JSON.stringify({ error: '応答の形式が不正です。再試行してください。' }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 音楽設定の検証（詳細な検証）
    const settings = validateMusicSettings(musicData);

    return new Response(
      JSON.stringify(settings),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        }
      }
    );

  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return new Response(
          JSON.stringify({ error: 'リクエストがタイムアウトしました。再試行してください。' }),
          { status: 504, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // 検証エラー
      if (error.message.includes('不正') || error.message.includes('必要') || error.message.includes('指定')) {
        console.error('Validation error:', error.message);
        return new Response(
          JSON.stringify({ error: `生成された設定が不正です: ${error.message}` }),
          { status: 502, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: '予期しないエラーが発生しました。再試行してください。' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
