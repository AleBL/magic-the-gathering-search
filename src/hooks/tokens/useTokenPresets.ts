import { logger } from '../../utils/logger';
import { useEffect, useState } from 'react';
import { tokenPresets, TokenPreset } from '../../components/playtest/PlaytestTokenModal';
import { ScryfallSearchResponse } from '../../types/Scryfall';

const PRESET_IMAGE_QUERY =
  't:token (name:soldier or name:zombie or name:goblin or name:thopter or name:saproling or name:bird or name:beast or name:treasure or name:food)';

const withFetchedImages = (fetched: ScryfallSearchResponse['data']): TokenPreset[] =>
  tokenPresets.map((preset) => {
    const match = fetched?.find((candidate) => candidate.name.toLowerCase() === preset.name.toLowerCase());
    const imageUrl = match?.image_uris?.normal || match?.card_faces?.[0]?.image_uris?.normal;
    return imageUrl ? { ...preset, imageUrl } : preset;
  });

/** The built-in token list, with real art pulled from Scryfall once per mount. */
export function useTokenPresets() {
  const [presets, setPresets] = useState<TokenPreset[]>(tokenPresets);

  useEffect(() => {
    const fetchPresetImages = async () => {
      try {
        const response = await fetch(
          `https://api.scryfall.com/cards/search?q=${encodeURIComponent(PRESET_IMAGE_QUERY)}`
        );
        if (!response.ok) return;
        const data = (await response.json()) as ScryfallSearchResponse;
        if (data.data && Array.isArray(data.data)) {
          setPresets(withFetchedImages(data.data));
        }
      } catch (error) {
        // Keep default preset images when dynamic fetch fails.
        logger.error('Failed to fetch preset token images:', error);
      }
    };
    fetchPresetImages();
  }, []);

  return presets;
}
