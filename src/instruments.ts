// Sample banks are distributed with their attribution in public/soundfonts/FluidR3_GM.
// The five synth presets below are original Web Audio settings.
export const instruments = [
  { id: 'piano', name: 'グランドピアノ', short: 'Grand Piano', family: '鍵盤', icon: '▥', description: 'サンプル音源による、自然なピアノの響き。', program: 0, gmName: 'Acoustic Grand Piano', file: 'acoustic_grand_piano', level: .65 },
  { id: 'guitar', name: 'ナイロンギター', short: 'Nylon Guitar', family: '弦楽器', icon: '♬', description: 'やさしく弾いたナイロン弦の音。', program: 24, gmName: 'Acoustic Guitar (nylon)', file: 'acoustic_guitar_nylon', level: .65 },
  { id: 'strings', name: 'ストリングス', short: 'String Ensemble', family: '弦楽器', icon: '≋', description: '重なり合う弦楽器の、豊かな広がり。', program: 48, gmName: 'String Ensemble 1', file: 'string_ensemble_1', level: .5 },
  { id: 'taiko', name: '太鼓', short: 'Taiko Drum', family: '打楽器', icon: '◉', description: '音高のある太鼓。ドラムキットではありません。', program: 116, gmName: 'Taiko Drum', file: 'taiko_drum', level: .6 },
  { id: 'tom', name: 'メロディックタム', short: 'Melodic Tom', family: '打楽器', icon: '◉', description: '音階に沿って演奏できるタムの響き。', program: 117, gmName: 'Melodic Tom', file: 'melodic_tom', level: .6 },
  { id: 'drum', name: 'シンセドラム', short: 'Synth Drum', family: '打楽器', icon: '◉', description: '電子的な打撃音。音符の高さで響きが変わります。', program: 118, gmName: 'Synth Drum', file: 'synth_drum', level: .6 },
  { id: 'electric', name: 'エレクトリックピアノ', short: 'Electric Piano', family: '鍵盤', icon: '▥', description: '丸い立ち上がりと、やわらかな余韻。', program: 4, gmName: 'Electric Piano 1', wave: 'triangle', attack: .012, sustain: .12, level: .12 },
  { id: 'organ', name: 'ドローバーオルガン', short: 'Drawbar Organ', family: 'オルガン', icon: '▤', description: 'なめらかに伸びる、温かい和音。', program: 16, gmName: 'Drawbar Organ', wave: 'sine', attack: .018, sustain: .85, level: .12 },
  { id: 'pad', name: 'ウォームパッド', short: 'Warm Pad', family: 'シンセ', icon: '≋', description: 'ゆっくりと広がる、空気のような響き。', program: 89, gmName: 'Pad 2 (warm)', wave: 'triangle', attack: .18, sustain: .72, level: .09 },
  { id: 'pluck', name: 'シンセプラック', short: 'Synth Pluck', family: 'シンセ', icon: '⌁', description: '短く弾む、輪郭のあるフレーズ。', program: 80, gmName: 'Lead 1 (square)', wave: 'square', attack: .006, sustain: .025, level: .045 },
  { id: 'bell', name: 'クリスタルベル', short: 'Crystal Bell', family: 'ベル', icon: '♧', description: '澄んだ高音がきらめく、軽やかな音。', program: 10, gmName: 'Music Box', wave: 'sine', attack: .004, sustain: .06, level: .14 },
] as const;
export type InstrumentId = typeof instruments[number]['id'];
export function instrumentFor(id: unknown) {
  const selectedId = id === undefined ? 'electric' : id;
  const instrument = instruments.find(item => item.id === selectedId);
  if (!instrument) throw new Error('対応していない音色です。音色を選び直してください。');
  return instrument;
}
