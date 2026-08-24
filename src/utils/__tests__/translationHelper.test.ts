import { afterEach, describe, expect, it, vi } from 'vitest';
import { translateCards } from '../translationHelper';
import { makeCard } from '../../test/factories';

const okResponse = (data: unknown) => ({ ok: true, json: async () => ({ data }) }) as unknown as Response;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('translateCards', () => {
  it('returns an empty array without hitting the network for an empty deck', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(translateCards([], 'pt')).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('replaces a card with its translated counterpart by oracle_id', async () => {
    const original = makeCard({
      oracle_id: 'o1',
      name: 'Forest',
      printed_name: 'Forest',
      image_uris: { small: '', normal: 'https://img/en.png', large: '', png: '' }
    });
    const translated = {
      oracle_id: 'o1',
      name: 'Forest',
      printed_name: 'Floresta',
      image_uris: { small: '', normal: 'https://img/pt.png', large: '', png: '' },
      multiverse_ids: [123]
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => okResponse([translated]))
    );

    const [result] = await translateCards([original], 'pt');

    expect(result.printed_name).toBe('Floresta');
    expect(result.image_uris?.gatherer).toContain('multiverseid=123');
  });

  it('falls back to the original cards when the request fails', async () => {
    const original = makeCard({ oracle_id: 'o1', name: 'Forest', printed_name: 'Forest' });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      })
    );

    const [result] = await translateCards([original], 'pt');

    expect(result.printed_name).toBe('Forest');
  });
});
