import { analyzeWithOpenAI, type AnalysisImage } from './openaiImageAnalysis.ts';

type Env = { OPENAI_API_KEY?: string; ASSETS: { fetch(request: Request): Promise<Response> } };
const MAX_IMAGE = 10 * 1024 * 1024;
const MAX_BODY = 20 * 1024 * 1024 + 65536;
const response = (status: number, body: unknown) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

function imageType(bytes: Uint8Array): AnalysisImage['mime'] | null {
  if (bytes.length >= 24 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 13 && bytes[5] === 10 && bytes[6] === 26 && bytes[7] === 10) return 'image/png';
  if (bytes.length >= 16 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9) return 'image/jpeg';
  if (bytes.length >= 20 && String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP') return 'image/webp';
  return null;
}

export async function handleImageAnalysis(request: Request, apiKey: string | undefined, analyze: typeof analyzeWithOpenAI = analyzeWithOpenAI): Promise<Response> {
  if (request.method !== 'POST') return response(405, { error: 'method_not_allowed' });
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('multipart/form-data;')) return response(400, { error: 'invalid_input' });
  if (!request.body) return response(400, { error: 'invalid_input' });
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > MAX_BODY) { await reader.cancel(); return response(413, { error: 'too_large' }); }
      chunks.push(part.value);
    }
    const body = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
    const form = await new Request(request.url, { method: 'POST', headers: { 'content-type': request.headers.get('content-type')! }, body }).formData();
    const entries = [...form.entries()];
    const files = form.getAll('images');
    const contexts = form.getAll('context');
    if (entries.some(([key]) => key !== 'images' && key !== 'context') || files.length < 1 || files.length > 5 || contexts.length > 1 ||
        (contexts.length === 1 && (typeof contexts[0] !== 'string' || Array.from(contexts[0]).length > 200)) ||
        files.some(file => typeof file === 'string' || file.size === 0 || file.size > MAX_IMAGE)) return response(400, { error: 'invalid_input' });
    const images: AnalysisImage[] = [];
    let total = 0;
    for (const file of files) {
      if (typeof file === 'string') return response(400, { error: 'invalid_input' });
      total += file.size;
      if (total > 20 * 1024 * 1024) return response(413, { error: 'too_large' });
      const bytes = new Uint8Array(await file.arrayBuffer());
      const mime = imageType(bytes);
      if (!mime || file.type !== mime) return response(400, { error: 'invalid_image' });
      images.push({ bytes, mime });
    }
    const result = await analyze(images, typeof contexts[0] === 'string' ? contexts[0] : '', apiKey);
    if (result.ok) return response(200, result);
    return response(result.reason === 'configuration' ? 503 : result.reason === 'timeout' ? 504 : 502, { error: result.reason });
  } catch { return response(400, { error: 'invalid_input' }); }
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path === '/api/image-analysis') return handleImageAnalysis(request, env.OPENAI_API_KEY);
    if (path.startsWith('/api/')) return Promise.resolve(response(404, { error: 'not_found' }));
    return env.ASSETS.fetch(request);
  },
};
