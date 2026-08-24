import { Deck } from '../../types/Deck';
import { downloadAsJson, downloadAsText } from '../../services/fileDownload';
import { deckExportFileName, deckToDecText } from '../../utils/deckText';

export function useDeckExport(savedDecks: Deck[]) {
  const exportDeck = (deck: Deck) => {
    downloadAsJson(deck, deckExportFileName(deck, 'json'));
  };

  const exportDeckAsDec = (deck: Deck) => {
    downloadAsText(deckToDecText(deck), deckExportFileName(deck, 'dec'));
  };

  const exportAllDecks = () => {
    downloadAsJson(savedDecks, `all-decks-${Date.now()}.json`);
  };

  return { exportDeck, exportDeckAsDec, exportAllDecks };
}
