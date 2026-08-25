import { ReactNode } from 'react';
import { Deck } from '../../types/Deck';
import SavedDecksPanel from './SavedDecksPanel';

interface DeckManagerDeckListLayoutProps {
  readonly showDeckList: boolean;
  readonly displayDecks: Deck[];
  readonly savedDeckCount: number;
  readonly selectedDeckId: string | null;
  readonly editingDeckId: string | null;
  readonly isMobileDeckListOpen: boolean;
  readonly onToggleMobileDeckList: () => void;
  readonly onSelectDeck: (deck: Deck | null) => void;
  readonly onEditDeck: (
    id: string,
    name: string,
    format: Deck['format'],
    cards: Deck['cards'],
    notes?: string,
    relatedTokens?: Deck['relatedTokens']
  ) => void;
  readonly onExportDeck: (deck: Deck) => void;
  readonly onDuplicateDeck: (deck: Deck) => void;
  readonly onNewFromDeck: (deck: Deck) => void;
  readonly onDeleteDeck: (deck: Deck) => void;
  readonly onChangeCover: (deck: Deck) => void;
  readonly deckPreview: ReactNode;
}

/**
 * At lg+ the two lanes scroll independently: one page-level scrollbar meant that
 * reading a long decklist dragged the saved-decks list along with it.
 *
 * `h-full`, not a `100vh` calculation: `.workspace-body` is already `flex-1` and
 * knows its own height, so guessing it from the viewport overshot by a dozen pixels
 * and left the wrapper with a third, barely-moving scrollbar. Below lg the layout is
 * a single column in normal page flow, so none of this applies.
 */
export function DeckManagerDeckListLayout({
  showDeckList,
  displayDecks,
  savedDeckCount,
  selectedDeckId,
  editingDeckId,
  isMobileDeckListOpen,
  onToggleMobileDeckList,
  onSelectDeck,
  onEditDeck,
  onExportDeck,
  onDuplicateDeck,
  onNewFromDeck,
  onDeleteDeck,
  onChangeCover,
  deckPreview
}: DeckManagerDeckListLayoutProps) {
  return (
    <div
      className={`grid grid-cols-1 ${showDeckList ? 'lg:grid-cols-[300px_1fr] xl:grid-cols-[320px_1fr]' : 'lg:grid-cols-1'} gap-4 p-4 lg:h-full lg:overflow-hidden`}
    >
      {showDeckList ? (
        <SavedDecksPanel
          decks={displayDecks}
          savedDeckCount={savedDeckCount}
          selectedDeckId={selectedDeckId}
          editingDeckId={editingDeckId}
          isMobileOpen={isMobileDeckListOpen}
          onToggleMobileOpen={onToggleMobileDeckList}
          onSelectDeck={onSelectDeck}
          onEditDeck={onEditDeck}
          onExportDeck={onExportDeck}
          onDuplicateDeck={onDuplicateDeck}
          onNewFromDeck={onNewFromDeck}
          onDeleteDeck={onDeleteDeck}
          onChangeCover={onChangeCover}
        />
      ) : null}
      <div className="col-span-1 min-w-0 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:pr-1">
        {deckPreview}
      </div>
    </div>
  );
}
