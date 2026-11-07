// ローカルで実画像とOpenAI接続を確認する手動用スクリプト。
import { readFile, stat } from 'node:fs/promises';
import { extname } from 'node:path';
import { analyzeWithOpenAI } from '../src/openaiImageAnalysis.ts';

const paths = process.argv.slice(2);
const mimeFor = (path) => ({ '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' })[extname(path).toLowerCase()];
if (paths.length < 1 || paths.length > 5 || paths.some(path => !mimeFor(path))) {
  console.error('使い方: node --env-file=.dev.vars scripts/check-openai-image.mjs <画像ファイル1〜5個>');
  process.exitCode = 1;
} else if (!process.env.OPENAI_API_KEY?.trim()) {
  console.error('OPENAI_API_KEY が設定されていません。');
  process.exitCode = 1;
} else {
  try {
    const infos = await Promise.all(paths.map(path => stat(path)));
    if (infos.some(info => !info.isFile() || info.size === 0 || info.size > 10 * 1024 * 1024) ||
        infos.reduce((total, info) => total + info.size, 0) > 20 * 1024 * 1024) throw new Error('size');
    const images = await Promise.all(paths.map(async path => ({ bytes: await readFile(path), mime: mimeFor(path) })));
    const result = await analyzeWithOpenAI(images, '', process.env.OPENAI_API_KEY);
    if (result.ok) console.log(JSON.stringify({ analysis: result.analysis, song: result.song }, null, 2));
    else { console.error(`分析できませんでした: ${result.reason}`); process.exitCode = 1; }
  } catch {
    console.error('画像を読み込めません。JPEG / PNG / WebP 各10 MiB以下・合計20 MiB以下のファイルを指定してください。');
    process.exitCode = 1;
  }
}
