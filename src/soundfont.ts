// Parse only the JSON object; never execute the downloaded MIDI.js script.
const banks = new Map<string, Promise<Record<string, string>>>();
const buffers = new Map<string, Promise<AudioBuffer>>();

async function bankFor(file: string): Promise<Record<string, string>> {
  let pending = banks.get(file);
  if (!pending) {
    pending = (async () => {
      const response = await fetch(`/soundfonts/FluidR3_GM/${file}-mp3.js`);
      if (!response.ok) throw new Error('音源ファイルを取得できませんでした。');
      const source = await response.text();
      const marker = `MIDI.Soundfont.${file} = `;
      const start = source.indexOf(marker);
      if (start < 0) throw new Error('音源ファイルの形式が不正です。');
      const json = source.slice(start + marker.length).trim().replace(/;\s*$/, '').replace(/,\s*}$/, '}');
      const value: unknown = JSON.parse(json);
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('音源データが不正です。');
      const bank: Record<string, string> = {};
      for (const [key, sample] of Object.entries(value)) {
        if (typeof sample !== 'string' || !sample.startsWith('data:audio/mp3;base64,')) throw new Error('音源サンプルが不正です。');
        bank[key] = sample;
      }
      return bank;
    })();
    banks.set(file, pending);
    void pending.catch(() => { if (banks.get(file) === pending) banks.delete(file); });
  }
  return pending;
}

export async function sampleFor(ctx: AudioContext, file: string, pitch: number): Promise<AudioBuffer> {
  const key = `${file}:${pitch}`;
  let pending = buffers.get(key);
  if (!pending) {
    pending = (async () => {
      const bank = await bankFor(file);
      const name = `${['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'][pitch%12]}${Math.floor(pitch/12)-1}`;
      const data = bank[name];
      if (!data) throw new Error(`音高${pitch}のサンプルがありません。`);
      const binary = atob(data.slice(data.indexOf(',')+1));
      const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
      return ctx.decodeAudioData(bytes.buffer);
    })();
    buffers.set(key, pending);
    void pending.catch(() => { if (buffers.get(key) === pending) buffers.delete(key); });
  }
  return pending;
}
