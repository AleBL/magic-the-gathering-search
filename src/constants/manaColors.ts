export const MANA_COLOR_GRADIENTS: Record<string, string> = {
  W: 'bg-gradient-to-br from-[#fff7de] to-[#f8e7b9] text-[#80724b] ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 ring-[#f8e7b9] shadow-lg scale-110 z-10',
  U: 'bg-gradient-to-br from-[#1a7bc4] to-[#0e68ab] text-white ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 ring-[#0e68ab] shadow-lg scale-110 z-10',
  B: 'bg-gradient-to-br from-[#2a1600] to-[#150b00] text-[#c0b3a3] ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 ring-[#150b00] shadow-lg scale-110 z-10',
  R: 'bg-gradient-to-br from-[#e63c45] to-[#d3202a] text-white ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 ring-[#d3202a] shadow-lg scale-110 z-10',
  G: 'bg-gradient-to-br from-[#008f4d] to-[#00733e] text-white ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 ring-[#00733e] shadow-lg scale-110 z-10',
  C: 'bg-gradient-to-br from-[#d6d6d6] to-[#a8a9ad] text-[#3f3f3f] ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 ring-[#a8a9ad] shadow-lg scale-110 z-10'
};

// {@link MANA_COLOR_GRADIENTS} minus ring, scale and z-index: on a full-width row those read
// as a stray halo around an oddly enlarged button rather than as a color cue.
export const MANA_COLOR_ROW_ACTIVE: Record<string, string> = {
  W: 'bg-gradient-to-r from-[#fff7de] to-[#f8e7b9] text-[#5c4f2e] shadow-md shadow-black/5',
  U: 'bg-gradient-to-r from-[#1a7bc4] to-[#0e68ab] text-white shadow-md shadow-blue-500/20',
  B: 'bg-gradient-to-r from-[#2a1600] to-[#150b00] text-[#e8ddd0] shadow-md shadow-black/20',
  R: 'bg-gradient-to-r from-[#e63c45] to-[#d3202a] text-white shadow-md shadow-red-500/20',
  G: 'bg-gradient-to-r from-[#008f4d] to-[#00733e] text-white shadow-md shadow-green-500/20',
  C: 'bg-gradient-to-r from-[#d6d6d6] to-[#a8a9ad] text-[#3f3f3f] shadow-md shadow-black/5'
};

/** Light backgrounds need a dark swatch overlay, not a light one. */
export const MANA_COLOR_IS_LIGHT: Record<string, boolean> = {
  W: true,
  U: false,
  B: false,
  R: false,
  G: false,
  C: true
};
