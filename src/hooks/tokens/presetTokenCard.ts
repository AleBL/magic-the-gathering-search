import { Card } from '../../types/Card';
import { TokenPreset } from '../../components/playtest/PlaytestTokenModal';
import { uniqueTokenId } from '../../utils/tokenCards';

/** Turns a built-in preset into a card the rest of the app can treat as any other token. */
export function buildPresetTokenCard(preset: TokenPreset, printedName: string): Card {
  return {
    id: uniqueTokenId(preset.id),
    oracle_id: `token-oracle-${preset.id}`,
    name: preset.name,
    printed_name: printedName,
    type_line: preset.type_line,
    printed_type_line: preset.type_line,
    oracle_text: preset.oracle_text,
    rarity: preset.rarity,
    set_name: preset.set_name,
    colors: preset.colors,
    color_identity: preset.colors,
    power: preset.power,
    toughness: preset.toughness,
    image_uris: preset.imageUrl
      ? {
          small: preset.imageUrl,
          normal: preset.imageUrl,
          large: preset.imageUrl,
          png: preset.imageUrl
        }
      : undefined
  };
}
