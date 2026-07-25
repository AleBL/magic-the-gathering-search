import { useTranslation } from 'react-i18next';
import { FaLayerGroup } from 'react-icons/fa';
import { Deck, DeckFormat } from '../../types/Deck';
import { DeckListItem } from '../deck/DeckListItem';

export interface DeckListProps {
  decks: Deck[];
  selectedDeckId: string | null;
  editingDeckId: string | null;
  onSelectDeck: (deck: Deck) => void;
  onEditDeck: (
    id: string,
    name: string,
    format: DeckFormat,
    cards: Deck['cards'],
    notes?: string,
    relatedTokens?: Deck['relatedTokens']
  ) => void;
  onExportDeck: (deck: Deck) => void;
  onDuplicateDeck: (deck: Deck) => void;
  onNewFromDeck: (deck: Deck) => void;
  onDeleteDeck: (deck: Deck) => void;
  onChangeCover: (deck: Deck) => void;
}

function DeckList({
  decks,
  selectedDeckId,
  editingDeckId,
  onSelectDeck,
  onEditDeck,
  onExportDeck,
  onDuplicateDeck,
  onNewFromDeck,
  onDeleteDeck,
  onChangeCover
}: DeckListProps) {
  const { t } = useTranslation();

  return (
    <div className="deck-list-section">
      <h3 className="text-gray-900 dark:text-white text-xl font-bold mb-4 transition-colors duration-300">
        {t('deck.savedDecks')} ({decks.length})
      </h3>
      <div className="space-y-2.5">
        {decks.length === 0 ? (
          <div className="empty-deck-list-state group">
            <div className="empty-deck-list-state-bg" />
            <div className="empty-deck-list-state-icon-wrapper">
              <FaLayerGroup className="text-xl text-purple-500 dark:text-purple-400" />
            </div>
            <p className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-1">{t('deck.noSavedDecks')}</p>
            <p className="text-xs text-gray-500 dark:text-slate-400">{t('deck.addCardsMessage')}</p>
          </div>
        ) : (
          decks.map((deck) => (
            <DeckListItem
              key={deck.id}
              deck={deck}
              isSelected={selectedDeckId === deck.id}
              isEditing={editingDeckId === deck.id}
              onSelect={onSelectDeck}
              onEdit={onEditDeck}
              onExport={onExportDeck}
              onDuplicate={onDuplicateDeck}
              onNewFrom={onNewFromDeck}
              onDelete={onDeleteDeck}
              onChangeCover={onChangeCover}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default DeckList;
