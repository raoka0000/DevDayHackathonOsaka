import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { build, createServer } from 'vite';
import { dirname, resolve } from 'node:path';

const require = createRequire(import.meta.url);
let worker;
let server;
let closing = false;
async function close(code) {
  if (closing) return;
  closing = true;
  await server?.close();
  worker?.kill('SIGTERM');
  process.exitCode = code;
}
process.on('SIGINT', () => { void close(0); });
process.on('SIGTERM', () => { void close(0); });

try {
  // Static Assetsの初回起動に必要。画面の更新は以後ViteのHMRで反映する。
  await build();
  if (!closing) {
    worker = spawn(process.execPath, [resolve(dirname(require.resolve('wrangler/package.json')), 'bin/wrangler.js'), 'dev', '--ip', '127.0.0.1', '--port', '8788', '--inspector-port', '0'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    worker.stderr.pipe(process.stderr);
    await new Promise((resolve, reject) => {
      let output = '';
      const timer = setTimeout(() => reject(new Error('写真分析APIの起動が時間切れになりました。')), 60000);
      worker.once('error', error => { clearTimeout(timer); reject(error); });
      worker.once('exit', code => {
        clearTimeout(timer);
        reject(new Error(`写真分析APIが終了しました（終了コード ${code}）。`));
        if (!closing) void close(code || 1);
      });
      worker.stdout.on('data', chunk => {
        process.stdout.write(chunk);
        output = (output + chunk.toString()).slice(-8192);
        if (output.includes('Ready on http://127.0.0.1:8788')) { clearTimeout(timer); resolve(); }
      });
    });
    if (!closing) {
      server = await createServer({ server: { host: '0.0.0.0' } });
      await server.listen();
      console.log('\n画面と写真分析はこちらのURLで利用できます：');
      server.printUrls();
    }
  }
} catch {
  console.error('開発サーバーを起動できませんでした。上のエラーとポート8788の使用状況を確認してください。');
  await close(1);
}
