import { Card } from '../types/Card';
import { Deck } from '../types/Deck';
import i18n from '../plugins/i18n';

export interface DecklistLine {
  count: number;
  name: string;
}

/** Groups a flat card array into `{ count, name }` lines sorted by card name. */
export function buildDecklistLines(cards: Card[]): DecklistLine[] {
  const counts = new Map<string, number>();
  for (const card of cards) counts.set(card.name, (counts.get(card.name) ?? 0) + 1);
  return Array.from(counts, ([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name));
}

const isLand = (card: Card): boolean => /\bland\b|terreno|tierra/i.test(card.type_line ?? '');

/** Copies per converted mana cost, bucketed 0..6 with index 7 meaning "7+". Lands excluded. */
export function buildManaCurve(cards: Card[]): number[] {
  const curve = new Array<number>(8).fill(0);
  for (const card of cards) {
    if (isLand(card)) continue;
    const cmc = Math.max(0, Math.floor(card.cmc ?? 0));
    curve[Math.min(cmc, 7)] += 1;
  }
  return curve;
}

export const COLOR_ORDER = ['W', 'U', 'B', 'R', 'G'] as const;
export type DeckColor = (typeof COLOR_ORDER)[number];

/** Copies contributing to each colour of the deck's identity. */
export function buildColorCounts(cards: Card[]): Record<DeckColor, number> {
  const counts = { W: 0, U: 0, B: 0, R: 0, G: 0 } as Record<DeckColor, number>;
  for (const card of cards) {
    for (const color of card.color_identity ?? []) {
      if ((COLOR_ORDER as readonly string[]).includes(color)) counts[color as DeckColor] += 1;
    }
  }
  return counts;
}

const TYPE_MATCHERS: { key: string; re: RegExp }[] = [
  { key: 'Creature', re: /creature|criatura/i },
  { key: 'Instant', re: /instant|instantânea|instantanea|instantáneo/i },
  { key: 'Sorcery', re: /sorcery|feitiço|feitico|conjuro/i },
  { key: 'Artifact', re: /artifact|artefato|artefacto/i },
  { key: 'Enchantment', re: /enchantment|encantamento/i },
  { key: 'Planeswalker', re: /planeswalker/i },
  { key: 'Land', re: /\bland\b|terreno|tierra/i }
];

/** Copies per primary card type, highest first, skipping empty buckets. */
export function buildTypeCounts(cards: Card[]): { key: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const card of cards) {
    const line = card.type_line ?? '';
    const match = TYPE_MATCHERS.find((entry) => entry.re.test(line));
    const key = match ? match.key : 'Other';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts, ([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
}

/** The deck's commander, else the card most likely to carry good key art. */
export function pickHeroCard(cards: Card[]): Card | undefined {
  return cards.find((card) => card.isCommander) ?? cards.find((card) => card.image_uris?.art_crop);
}

const COLOR_HEX: Record<DeckColor, string> = {
  W: '#f8f3d8',
  U: '#3b82f6',
  B: '#6b7280',
  R: '#ef4444',
  G: '#22c55e'
};

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Renders a shareable 1200x630 deck card: commander art on the left, deck
 * identity plus mana curve, colours and type breakdown on the right. Uses the
 * Canvas API only — no rendering dependency.
 */
export async function renderDeckImage(deck: Deck): Promise<Blob> {
  const W = 1200;
  const H = 630;
  const scale = 2;

  const canvas = document.createElement('canvas');
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.scale(scale, scale);

  // Backdrop
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0b1220');
  bg.addColorStop(1, '#131c33');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Hero art panel (left third), faded into the backdrop.
  const artW = 430;
  const hero = pickHeroCard(deck.cards);
  const artUrl = hero?.image_uris?.art_crop || hero?.card_faces?.[0]?.image_uris?.art_crop;
  if (artUrl) {
    const img = await loadImage(artUrl);
    if (img) {
      const ratio = Math.max(artW / img.width, H / img.height);
      const dw = img.width * ratio;
      const dh = img.height * ratio;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, artW, H);
      ctx.clip();
      ctx.drawImage(img, (artW - dw) / 2, (H - dh) / 2, dw, dh);
      const fade = ctx.createLinearGradient(artW - 160, 0, artW, 0);
      fade.addColorStop(0, 'rgba(11,18,32,0)');
      fade.addColorStop(1, 'rgba(11,18,32,1)');
      ctx.fillStyle = fade;
      ctx.fillRect(artW - 160, 0, 160, H);
      ctx.restore();
    }
  }

  const x = artUrl ? artW + 48 : 56;
  const contentW = W - x - 56;

  // Title block
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 46px sans-serif';
  const title = deck.name.length > 26 ? `${deck.name.slice(0, 25)}…` : deck.name;
  ctx.fillText(title, x, 92);

  ctx.fillStyle = '#93a4c3';
  ctx.font = '20px sans-serif';
  ctx.fillText(`${deck.format} · ${deck.cards.length} ${i18n.t('common.cards')}`, x, 126);

  // Colour identity pips
  const colors = buildColorCounts(deck.cards);
  let pipX = x;
  for (const color of COLOR_ORDER) {
    if (colors[color] === 0) continue;
    ctx.beginPath();
    ctx.arc(pipX + 11, 166, 11, 0, Math.PI * 2);
    ctx.fillStyle = COLOR_HEX[color];
    ctx.fill();
    pipX += 30;
  }

  // Mana curve
  const curve = buildManaCurve(deck.cards);
  const peak = Math.max(1, ...curve);
  const chartY = 250;
  const chartH = 150;
  const barGap = 12;
  const barW = (contentW - barGap * 7) / 8;

  ctx.fillStyle = '#93a4c3';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(i18n.t('stats.manaCurve'), x, chartY - 18);

  curve.forEach((count, cmc) => {
    const bx = x + cmc * (barW + barGap);
    const bh = Math.round((count / peak) * chartH);
    ctx.fillStyle = 'rgba(148,163,184,0.16)';
    roundedRect(ctx, bx, chartY, barW, chartH, 6);
    ctx.fill();
    if (bh > 0) {
      ctx.fillStyle = '#3b82f6';
      roundedRect(ctx, bx, chartY + chartH - bh, barW, bh, 6);
      ctx.fill();
    }
    ctx.fillStyle = '#64748b';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(cmc === 7 ? '7+' : String(cmc), bx + barW / 2, chartY + chartH + 22);
    if (count > 0) {
      ctx.fillStyle = '#cbd5e1';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(String(count), bx + barW / 2, chartY + chartH - bh - 8);
    }
    ctx.textAlign = 'left';
  });

  // Type breakdown
  const types = buildTypeCounts(deck.cards).slice(0, 4);
  let typeX = x;
  types.forEach((entry) => {
    const label = `${entry.count} ${entry.key}`;
    ctx.font = 'bold 15px sans-serif';
    const boxW = ctx.measureText(label).width + 26;
    ctx.fillStyle = 'rgba(148,163,184,0.14)';
    roundedRect(ctx, typeX, 470, boxW, 34, 17);
    ctx.fill();
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(label, typeX + 13, 492);
    typeX += boxW + 10;
  });

  // Footer
  ctx.fillStyle = '#5a6b8a';
  ctx.font = '15px sans-serif';
  ctx.fillText(`${i18n.t('common.generatedBy')} ${i18n.t('common.appTitle')}`, x, H - 40);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Failed to render deck image'))), 'image/png');
  });
}
