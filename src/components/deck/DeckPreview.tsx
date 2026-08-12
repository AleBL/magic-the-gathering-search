import { lazy, Suspense, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaLayerGroup, FaPencilAlt, FaChartBar } from 'react-icons/fa';
import { Card } from '../../types/Card';
import { Deck, DeckFormat, DeckRelatedToken } from '../../types/Deck';
import { CardSize } from '../../types';
import { validateDeck } from '../../utils/deckValidator';
import { useDeckPreviewState } from '../../hooks/useDeckPreviewState';
import { DeckFormatType, DeckZone } from '../../types/enums';
import { useTokenHandlers } from '../../hooks/useTokenHandlers';
import { dispatchPendingAction, usePendingAction } from '../../hooks/usePendingAction';
import EmptyState from '../ui/EmptyState';
import DeckValidationBadge from './DeckValidationBadge';
import DeckFloatingPreview from '../deck/DeckFloatingPreview';
import DeckZoneTabs from '../deck/DeckZoneTabs';
import DeckActionBar from '../deck/DeckActionBar';
import DeckNotesEditor from '../deck/DeckNotesEditor';
import DeckCardList from '../deck/DeckCardList';
import DeckStackView from '../deck/DeckStackView';
import { DeckPreviewShell } from '../deck/DeckPreviewShell';
import { SavedDeckHeader, WorkingDeckHeader } from '../deck/DeckPreviewHeaders';
import DeckTokensTab from '../deck/DeckTokensTab';
import { DeckDisplayOptions } from '../deck/DeckDisplayOptions';
import { DeckStatsFilteredCards } from '../deck/DeckStatsFilteredCards';
import { DeckCollectionSummary } from '../deck/DeckCollectionSummary';
import CardDetailModal from '../card/CardDetailModal';
import DeckPreviewOverlays from './DeckPreviewOverlays';
import DeckStatsModal from './DeckStatsModal';

const DeckStats = lazy(() => import('../stats/DeckStats'));

interface DeckPreviewProps {
  selectedDeck: Deck | null;
  currentDeck: Card[];
  cardSize: CardSize;
  editingDeckId: string | null;
  editingDeckNotes?: string;
  onUpdateNotes?: (notes: string) => void;
  onUpdateCardZone?: (cardId: string, zone: DeckZone) => void;
  onLoadDeckToEdit: (
    id: string,
    name: string,
    format: DeckFormat,
    cards: Card[],
    notes?: string,
    relatedTokens?: DeckRelatedToken[]
  ) => void;
  onDeselectDeck: () => void;
  onAddToDeck: (card: Card) => void;
  onRemoveFromDeck: (card: Card) => void;
  onToggleCommander: (card: Card) => void;
  activeFormat?: DeckFormat;
  showToast: (text: string) => void;
  onCardSizeChange?: (size: CardSize) => void;
  onSaveNotesDirectly?: (deckId: string, notes: string) => void;
  onApplySuggestedLands?: (landCounts: Record<string, number>) => void;
  onUpdateCard?: (updatedCard: Card) => void;
  onSaveTokens?: (deckId: string, tokens: DeckRelatedToken[]) => void;
  deckRelatedTokens?: DeckRelatedToken[];
  onEditInfo?: (deck: Deck) => void;
}

function DeckPreview({
  selectedDeck,
  currentDeck,
  cardSize,
  editingDeckId,
  editingDeckNotes = '',
  onUpdateNotes,
  onUpdateCardZone,
  onLoadDeckToEdit,
  onDeselectDeck,
  onAddToDeck,
  onRemoveFromDeck,
  onToggleCommander,
  activeFormat,
  showToast,
  onCardSizeChange,
  onSaveNotesDirectly,
  onApplySuggestedLands,
  onUpdateCard,
  onSaveTokens,
  deckRelatedTokens,
  onEditInfo
}: DeckPreviewProps) {
  const { t } = useTranslation();
  // While editing, the deck lives in a narrow pane, so stats open in a wide
  // modal instead of the cramped inline tab.
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);

  const {
    viewMode,
    setViewMode,
    hoveredCard,
    mousePos,
    isPlaytestOpen,
    setIsPlaytestOpen,
    isProxyPrintOpen,
    setIsProxyPrintOpen,
    activeNoteTab,
    setActiveNoteTab,
    activeZone,
    setActiveZone,
    selectedTokenForView,
    setSelectedTokenForView,
    groupBy,
    setGroupBy,
    sortBy,
    setSortBy,
    isDisplaySettingsOpen,
    setIsDisplaySettingsOpen,
    activeCards,
    commanders,
    activeTokens,
    groupedCards,
    zoneCounts,
    handleHoverEnter,
    handleHoverMove,
    handleHoverLeave
  } = useDeckPreviewState({ selectedDeck, currentDeck, activeFormat, deckRelatedTokens });

  // Passed to two memoised CardGrids. Built inline it was a fresh array on every
  // render, which fails memo's shallow compare and re-rendered both grids — and every
  // memoised CardItem inside them — on any unrelated DeckPreview state change.
  const activeTokenCards = useMemo(() => activeTokens.map((token) => token.tokenCard), [activeTokens]);

  const { handleDeleteTokenCard, handleAddTokenCardCopy, handleUpdateTokenCard } = useTokenHandlers({
    activeTokens,
    selectedDeckId: selectedDeck?.id,
    editingDeckId,
    onSaveTokens,
    manualAdditionLabel: t('common.manualAddition'),
    setSelectedTokenForView
  });

  const handleTokensLoaded = useCallback(
    (tokens: DeckRelatedToken[]) => {
      if (selectedDeck && onSaveTokens) {
        onSaveTokens(selectedDeck.id, tokens);
      } else if (onSaveTokens) {
        onSaveTokens(editingDeckId || '', tokens);
      }
    },
    [selectedDeck, onSaveTokens, editingDeckId]
  );

  const handleClosePlaytest = useCallback(() => setIsPlaytestOpen(false), [setIsPlaytestOpen]);
  const handleCloseProxyPrint = useCallback(() => setIsProxyPrintOpen(false), [setIsProxyPrintOpen]);
  const handleCloseTokenModal = useCallback(() => setSelectedTokenForView(null), [setSelectedTokenForView]);
  const handleOpenPlaytest = useCallback(() => setIsPlaytestOpen(true), [setIsPlaytestOpen]);
  const handleOpenProxyPrint = useCallback(() => setIsProxyPrintOpen(true), [setIsProxyPrintOpen]);

  usePendingAction({
    'playtest-deck': handleOpenPlaytest,
    'print-proxies': handleOpenProxyPrint
  });

  const handleLoadSelectedDeckToEdit = useCallback(() => {
    if (selectedDeck) {
      onLoadDeckToEdit(
        selectedDeck.id,
        selectedDeck.name,
        selectedDeck.format || DeckFormatType.FREEFORM,
        selectedDeck.cards,
        selectedDeck.notes,
        selectedDeck.relatedTokens
      );
    }
  }, [selectedDeck, onLoadDeckToEdit]);

  const noteTabHeader = (
    <div className="deck-content-tab-bar">
      <button
        type="button"
        onClick={() => setActiveNoteTab('cards')}
        className={`deck-content-tab ${activeNoteTab === 'cards' ? 'deck-content-tab-active' : ''}`}
      >
        <FaLayerGroup className="text-[11px]" /> {t('deck.currentDeck')}
      </button>
      <button
        type="button"
        onClick={() => (editingDeckId ? setIsStatsModalOpen(true) : setActiveNoteTab('stats'))}
        className={`deck-content-tab ${!editingDeckId && activeNoteTab === 'stats' ? 'deck-content-tab-active' : ''}`}
      >
        <FaChartBar className="text-[11px]" /> {t('stats.deckStats')}
      </button>
      <button
        type="button"
        onClick={() => setActiveNoteTab('notes')}
        className={`deck-content-tab ${activeNoteTab === 'notes' ? 'deck-content-tab-active' : ''}`}
      >
        <FaPencilAlt className="text-[11px]" /> {t('strategy.strategyGuide')}
      </button>
    </div>
  );

  const renderCards = (isRemovable: boolean) => (
    <>
      {/* Display Options & Deck Navigation */}
      <div className="deck-zone-row">
        <DeckZoneTabs
          mainCount={zoneCounts.main}
          sideCount={zoneCounts.sideboard}
          maybeCount={zoneCounts.maybeboard}
          tokensCount={zoneCounts.tokens}
          activeZone={activeZone}
          onZoneChange={setActiveZone}
          onUpdateCardZone={onUpdateCardZone}
        />
      </div>
      {activeZone === 'tokens' ? (
        <DeckTokensTab
          cards={activeCards}
          cachedTokens={deckRelatedTokens || selectedDeck?.relatedTokens}
          onTokensLoaded={handleTokensLoaded}
          onTokenClick={setSelectedTokenForView}
          onlyHeader={true}
          isEditMode={isRemovable}
        />
      ) : null}
      {viewMode === 'stack' ? (
        <DeckStackView
          groups={groupedCards}
          cardSize={cardSize}
          isRemovable={isRemovable}
          activeFormat={selectedDeck ? selectedDeck.format : activeFormat}
          onHoverEnter={handleHoverEnter}
          onHoverMove={handleHoverMove}
          onHoverLeave={handleHoverLeave}
          onRemoveFromDeck={activeZone === 'tokens' ? handleDeleteTokenCard : onRemoveFromDeck}
          onAddToDeck={activeZone === 'tokens' ? handleAddTokenCardCopy : onAddToDeck}
          onAddTokenToDeck={handleAddTokenCardCopy}
          onUpdateCard={onUpdateCard}
          isTokenZone={activeZone === 'tokens'}
          onUpdateCardZone={onUpdateCardZone}
        />
      ) : (
        <DeckCardList
          groups={groupedCards}
          commanders={commanders}
          cardSize={cardSize}
          viewMode={viewMode}
          isRemovable={isRemovable}
          isTokenZone={activeZone === 'tokens'}
          activeFormat={selectedDeck ? selectedDeck.format : activeFormat}
          onUpdateCardZone={onUpdateCardZone}
          onAddToDeck={activeZone === 'tokens' ? handleAddTokenCardCopy : onAddToDeck}
          onAddTokenToDeck={handleAddTokenCardCopy}
          onRemoveFromDeck={activeZone === 'tokens' ? handleDeleteTokenCard : onRemoveFromDeck}
          onToggleCommander={onToggleCommander}
          onHoverEnter={handleHoverEnter}
          onHoverMove={handleHoverMove}
          onHoverLeave={handleHoverLeave}
          onUpdateCard={activeZone === 'tokens' ? handleUpdateTokenCard : onUpdateCard}
        />
      )}
    </>
  );

  /**
   * One return for both cases. What actually differs between a saved deck and the working deck
   * is the header, where stats are shown, whether cards can be removed, and the empty state —
   * everything else was written out twice and had already started to drift.
   */
  const deckCards = selectedDeck ? selectedDeck.cards : currentDeck;
  const deckFormat = selectedDeck
    ? selectedDeck.format || DeckFormatType.FREEFORM
    : activeFormat || DeckFormatType.FREEFORM;
  // A saved deck always shows its summary; the working deck only once it holds something.
  const showSummary = Boolean(selectedDeck) || currentDeck.length > 0;

  return (
    <DeckPreviewShell
      accent={!selectedDeck && Boolean(editingDeckId)}
      header={
        selectedDeck ? (
          <SavedDeckHeader deck={selectedDeck} onEditInfo={onEditInfo} />
        ) : (
          <WorkingDeckHeader isEditing={Boolean(editingDeckId)} cardCount={activeCards.length} />
        )
      }
      controls={
        showSummary ? (
          <>
            <DeckDisplayOptions
              viewMode={viewMode}
              setViewMode={setViewMode}
              groupBy={groupBy}
              setGroupBy={setGroupBy}
              sortBy={sortBy}
              setSortBy={setSortBy}
              cardSize={cardSize}
              onCardSizeChange={onCardSizeChange}
              isOpen={isDisplaySettingsOpen}
              setIsOpen={setIsDisplaySettingsOpen}
            />
            <DeckActionBar
              cards={activeCards}
              showToast={showToast}
              onPlaytest={handleOpenPlaytest}
              onPrintProxies={handleOpenProxyPrint}
              {...(selectedDeck
                ? { selectedDeck, onLoadDeckToEdit: handleLoadSelectedDeckToEdit, onDeselectDeck }
                : {})}
            />
          </>
        ) : null
      }
    >
      {showSummary ? (
        <div className="mb-4 flex flex-col gap-3">
          <DeckValidationBadge validation={validateDeck(deckCards, deckFormat)} formatKey={deckFormat} />
          <DeckCollectionSummary cards={deckCards} />
        </div>
      ) : null}

      {noteTabHeader}

      {activeNoteTab === 'notes' ? (
        selectedDeck ? (
          <DeckNotesEditor
            initialNotes={selectedDeck.notes || ''}
            isEditable={true}
            onSave={(notes) => onSaveNotesDirectly?.(selectedDeck.id, notes)}
          />
        ) : (
          <DeckNotesEditor initialNotes={editingDeckNotes} isEditable={true} onSave={onUpdateNotes} />
        )
      ) : selectedDeck && activeNoteTab === 'stats' ? (
        /* Inline for a saved deck. The working deck sends the same tab to a modal instead
           (see noteTabHeader), which is why this branch is guarded by `selectedDeck`. */
        <Suspense
          fallback={<div className="p-8 text-center text-slate-500 dark:text-slate-400">{t('common.loading')}...</div>}
        >
          <DeckStats
            currentDeck={activeCards}
            renderFilteredCards={(filteredCards) => (
              <DeckStatsFilteredCards
                filteredCards={filteredCards}
                selectedDeck={selectedDeck}
                activeFormat={activeFormat}
                viewMode={viewMode}
                groupBy={groupBy}
                sortBy={sortBy}
                cardSize={cardSize}
                commanders={commanders}
                onHoverEnter={handleHoverEnter}
                onHoverMove={handleHoverMove}
                onHoverLeave={handleHoverLeave}
                onRemoveFromDeck={onRemoveFromDeck}
                onAddToDeck={onAddToDeck}
                onAddTokenToDeck={handleAddTokenCardCopy}
                onToggleCommander={onToggleCommander}
                onUpdateCard={onUpdateCard}
                onUpdateCardZone={onUpdateCardZone}
              />
            )}
          />
        </Suspense>
      ) : !selectedDeck && currentDeck.length === 0 ? (
        <EmptyState
          icon={<FaLayerGroup />}
          title={t('deck.emptyDeck')}
          description={t('deck.addCardsMessage')}
          action={{
            label: t('search.searchForCards'),
            onClick: () => {
              // In the two-pane editor the search is already on screen — just
              // focus it rather than switching to the standalone search tab.
              dispatchPendingAction('focus-search');
            }
          }}
        />
      ) : (
        // Only the working deck's cards can be removed from here.
        renderCards(!selectedDeck)
      )}

      {!selectedDeck && isStatsModalOpen ? (
        <DeckStatsModal
          cards={activeCards}
          onApplySuggestedLands={onApplySuggestedLands}
          onClose={() => setIsStatsModalOpen(false)}
          renderFilteredCards={(filteredCards) => (
            <DeckStatsFilteredCards
              filteredCards={filteredCards}
              selectedDeck={selectedDeck}
              activeFormat={activeFormat}
              viewMode={viewMode}
              groupBy={groupBy}
              sortBy={sortBy}
              cardSize={cardSize}
              commanders={commanders}
              onHoverEnter={handleHoverEnter}
              onHoverMove={handleHoverMove}
              onHoverLeave={handleHoverLeave}
              onRemoveFromDeck={onRemoveFromDeck}
              onAddToDeck={onAddToDeck}
              onAddTokenToDeck={handleAddTokenCardCopy}
              onToggleCommander={onToggleCommander}
              onUpdateCard={onUpdateCard}
              onUpdateCardZone={onUpdateCardZone}
            />
          )}
        />
      ) : null}

      {viewMode === 'list' && activeNoteTab === 'cards' && hoveredCard ? (
        <DeckFloatingPreview card={hoveredCard} mousePos={mousePos} />
      ) : null}

      <DeckPreviewOverlays
        cards={activeCards}
        isPlaytestOpen={isPlaytestOpen}
        onClosePlaytest={handleClosePlaytest}
        isProxyPrintOpen={isProxyPrintOpen}
        onCloseProxyPrint={handleCloseProxyPrint}
        deckFormat={selectedDeck ? selectedDeck.format || DeckFormatType.FREEFORM : activeFormat}
        deckName={selectedDeck?.name}
        deckRelatedTokens={selectedDeck ? deckRelatedTokens || selectedDeck.relatedTokens : deckRelatedTokens}
      />

      {selectedTokenForView ? (
        <CardDetailModal
          card={selectedTokenForView}
          imageUrl={
            selectedTokenForView.image_uris?.normal || selectedTokenForView.card_faces?.[0]?.image_uris?.normal || ''
          }
          onClose={handleCloseTokenModal}
          isDeckCard={true}
          isToken={true}
          deckCards={activeTokenCards}
          deckRelatedTokens={activeTokens}
          // A saved deck's tokens are read-only here; the working deck's can be edited.
          isEditMode={!selectedDeck}
          {...(selectedDeck
            ? {}
            : {
                onSelectPrint: handleUpdateTokenCard,
                onRemoveFromDeck: handleDeleteTokenCard,
                onAddToDeck: handleAddTokenCardCopy,
                onAddTokenToDeck: handleAddTokenCardCopy
              })}
        />
      ) : null}
    </DeckPreviewShell>
  );
}

export default DeckPreview;
