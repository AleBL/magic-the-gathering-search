import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../plugins/i18n';
import { downloadAsJson, downloadAsText, downloadBlob } from '../fileDownload';

/**
 * The only path in the app that hands a file to the browser, and the one place where a
 * failure is invisible by construction: nothing is rendered, so a download that silently
 * did not happen looks exactly like one the user has not clicked yet.
 *
 * jsdom has neither object URLs nor navigation, so both are stubbed. What is asserted is
 * what the browser would actually act on: the anchor's `download` name, the bytes and MIME
 * type of the blob behind its href, and that the object URL is released afterwards.
 */
describe('fileDownload', () => {
  const objectUrls = new Map<string, Blob>();
  const revoked: string[] = [];
  const clicked: HTMLAnchorElement[] = [];
  const toasts: { message: string; variant: string }[] = [];

  const realCreateObjectURL = URL.createObjectURL;
  const realRevokeObjectURL = URL.revokeObjectURL;
  const onToast = (event: Event) => toasts.push((event as CustomEvent).detail);

  /** The blob the browser would have saved for the nth download. */
  const downloadedBlob = (index = 0): Blob => objectUrls.get(clicked[index].getAttribute('href')!)!;

  beforeEach(() => {
    objectUrls.clear();
    revoked.length = 0;
    clicked.length = 0;
    toasts.length = 0;

    URL.createObjectURL = vi.fn((blob: Blob) => {
      const url = `blob:deckforge/${objectUrls.size + 1}`;
      objectUrls.set(url, blob);
      return url;
    });
    URL.revokeObjectURL = vi.fn((url: string) => void revoked.push(url));

    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this);
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    window.addEventListener('global-toast', onToast);
  });

  afterEach(() => {
    URL.createObjectURL = realCreateObjectURL;
    URL.revokeObjectURL = realRevokeObjectURL;
    window.removeEventListener('global-toast', onToast);
    vi.restoreAllMocks();
  });

  describe('downloadBlob', () => {
    it('saves the blob under the name it was given', () => {
      const blob = new Blob(['4 Lightning Bolt'], { type: 'text/plain' });

      downloadBlob(blob, 'burn.dec');

      expect(clicked).toHaveLength(1);
      // Without `download` the browser navigates to the blob instead of saving it, which
      // replaces the app with a blank tab.
      expect(clicked[0].download).toBe('burn.dec');
      expect(downloadedBlob()).toBe(blob);
    });

    // An object URL pins its blob in memory until it is revoked, so a session of exports
    // would hold every file it ever wrote.
    it('releases the object URL once the click has been made', () => {
      downloadBlob(new Blob(['x']), 'x.txt');

      expect(revoked).toEqual([clicked[0].getAttribute('href')]);
    });
  });

  describe('downloadAsJson', () => {
    it('writes indented JSON under the JSON media type', async () => {
      downloadAsJson({ name: 'Burn', cards: [] }, 'burn.json');

      const blob = downloadedBlob();
      expect(blob.type).toBe('application/json');
      // Indented on purpose: an exported deck is a file people open and edit by hand.
      await expect(blob.text()).resolves.toBe('{\n  "name": "Burn",\n  "cards": []\n}');
      expect(clicked[0].download).toBe('burn.json');
    });

    it('says something when the data cannot be serialized, instead of failing quietly', () => {
      const circular: Record<string, unknown> = {};
      circular.self = circular;

      downloadAsJson(circular, 'broken.json');

      expect(clicked).toHaveLength(0);
      expect(toasts).toEqual([{ message: i18n.t('common.unexpectedError'), variant: 'danger' }]);
    });
  });

  describe('downloadAsText', () => {
    it('defaults to UTF-8 plain text, so accented card names survive the round trip', async () => {
      downloadAsText('4 Relâmpago', 'burn.dec');

      const blob = downloadedBlob();
      expect(blob.type).toBe('text/plain;charset=utf-8');
      await expect(blob.text()).resolves.toBe('4 Relâmpago');
    });

    it('honours a media type the caller asked for', () => {
      downloadAsText('name,quantity', 'collection.csv', 'text/csv;charset=utf-8');

      expect(downloadedBlob().type).toBe('text/csv;charset=utf-8');
    });

    it('says something when the browser refuses to make the file', () => {
      vi.mocked(URL.createObjectURL).mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      downloadAsText('4 Lightning Bolt', 'burn.dec');

      expect(clicked).toHaveLength(0);
      expect(toasts).toEqual([{ message: i18n.t('common.unexpectedError'), variant: 'danger' }]);
    });
  });
});
