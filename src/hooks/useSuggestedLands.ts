import { Card } from '../types/Card';
import { DeckFormat } from '../types/Deck';
import { MANA_COLOR_TO_BASIC_LAND } from '../utils/deckStatistics';
import { scryfallNamedImageUrl } from '../constants/urls';

export function useSuggestedLands(
  currentDeck: Card[],
  editingDeckId: string | null,
  editingDeckName: string,
  activeFormat: DeckFormat,
  editingDeckNotes: string | undefined,
  onLoadDeckToEdit: (id: string, name: string, format: DeckFormat, cards: Card[], notes?: string) => void,
  showToast: (text: string) => void,
  t: (key: string) => string
) {
  const handleApplySuggestedLands = (landCounts: Record<string, number>) => {
    const createBasicLandCard = (name: string): Card => {
      // Derived from the canonical color→land map (deckStatistics) so land
      // names and colors can never drift from the suggestion math. Wastes
      // produces {C}, which is not a color — hence the empty array.
      const colorsMap: Record<string, string[]> = Object.fromEntries(
        Object.entries(MANA_COLOR_TO_BASIC_LAND).map(([color, landName]) => [landName, color === 'C' ? [] : [color]])
      );

      const imageUrlFor = (landName: string) => scryfallNamedImageUrl(landName);

      return {
        id: `${name.toLowerCase()}-basic-land`,
        oracle_id: `basic-land-oracle-${name.toLowerCase()}`,
        name: name,
        printed_name: name,
        type_line: 'Basic Land',
        printed_type_line: 'Terreno Básico',
        mana_cost: '',
        cmc: 0,
        rarity: 'common',
        set_name: 'Standard Basic Lands',
        colors: colorsMap[name] || [],
        color_identity: colorsMap[name] || [],
        image_uris: {
          small: imageUrlFor(name),
          normal: imageUrlFor(name),
          large: imageUrlFor(name),
          png: imageUrlFor(name)
        }
      };
    };

    const newBasicLands: Card[] = [];
    Object.entries(landCounts).forEach(([landName, count]) => {
      for (let landCopyIndex = 0; landCopyIndex < count; landCopyIndex++) {
        newBasicLands.push(createBasicLandCard(landName));
      }
    });

    const newDeckCards = [...currentDeck, ...newBasicLands];
    // Preserve the current editing state — never use '' as deckId if we're genuinely editing
    onLoadDeckToEdit(editingDeckId ?? '', editingDeckName || '', activeFormat, newDeckCards, editingDeckNotes);
    showToast(t('deck.deckSaved'));
  };

  return { handleApplySuggestedLands };
}
