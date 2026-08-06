import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';

/**
 * WCAG 2.2 SC 1.4.3: 4.5:1 for body text, 3:1 for large text (>=24px, or >=18.66px bold).
 * Computed from what the browser paints, so a token that only fails in one theme is caught.
 */

interface ContrastFailure {
  text: string;
  ratio: number;
  required: number;
  color: string;
  background: string;
}

async function findContrastFailures(page: Page): Promise<ContrastFailure[]> {
  return page.evaluate(() => {
    // Tailwind v4 emits oklch(); a canvas makes the browser normalise any colour space.
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

    const parseRgb = (value: string): [number, number, number, number] | null => {
      if (!value) return null;
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = '#000000';
      ctx.fillStyle = value;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
      return [r, g, b, a / 255];
    };

    const luminance = ([r, g, b]: number[]) => {
      const channel = (c: number) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    };

    /** Walks ancestors until something paints an opaque background. */
    const effectiveBackground = (el: Element): [number, number, number] | null => {
      let node: Element | null = el;
      while (node) {
        const style = getComputedStyle(node);
        // A gradient behind the text makes a flat ratio meaningless.
        if (style.backgroundImage && style.backgroundImage !== 'none') return null;
        const rgb = parseRgb(style.backgroundColor);
        if (rgb && rgb[3] === 1) return [rgb[0], rgb[1], rgb[2]];
        if (rgb && rgb[3] > 0 && rgb[3] < 1) return null; // translucent: not a flat comparison
        node = node.parentElement;
      }
      return [255, 255, 255];
    };

    const failures: ContrastFailure[] = [];
    const seen = new Set<string>();

    for (const el of Array.from(document.querySelectorAll('*'))) {
      // Only elements that render text of their own.
      const ownText = Array.from(el.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent?.trim() ?? '')
        .join(' ')
        .trim();
      if (!ownText) continue;

      const style = getComputedStyle(el);
      if (style.visibility === 'hidden' || style.display === 'none' || parseFloat(style.opacity) < 0.99) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;

      const fg = parseRgb(style.color);
      const bg = effectiveBackground(el);
      if (!fg || !bg || fg[3] < 1) continue;

      const size = parseFloat(style.fontSize);
      const weight = parseInt(style.fontWeight, 10) || 400;
      const isLarge = size >= 24 || (size >= 18.66 && weight >= 700);
      const required = isLarge ? 3 : 4.5;

      const l1 = luminance([fg[0], fg[1], fg[2]]);
      const l2 = luminance(bg);
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

      if (ratio >= required) continue;
      const key = `${ownText.slice(0, 30)}|${style.color}|${ratio.toFixed(2)}`;
      if (seen.has(key)) continue;
      seen.add(key);

      failures.push({
        text: ownText.slice(0, 40),
        ratio: Math.round(ratio * 100) / 100,
        required,
        color: style.color,
        background: `rgb(${bg.join(', ')})`
      });
    }
    return failures;
  });
}

for (const theme of ['light', 'dark'] as const) {
  test(`text meets WCAG AA contrast in the ${theme} theme`, async ({ appPage }) => {
    await appPage.addInitScript((mode) => {
      window.localStorage.setItem('deckforge_dark_mode', String(mode === 'dark'));
    }, theme);
    // getComputedStyle mid-transition returns interpolated values, which vary run to run.
    // Reduced motion makes the app's global rule collapse transitions to 0.01ms.
    await appPage.emulateMedia({ reducedMotion: 'reduce' });
    await appPage.goto('/');
    await expect(appPage.getByRole('banner')).toBeVisible();
    await appPage.waitForTimeout(200);

    const failures = await findContrastFailures(appPage);
    expect(failures, `${failures.length} low-contrast texts:\n${JSON.stringify(failures, null, 2)}`).toEqual([]);
  });
}
