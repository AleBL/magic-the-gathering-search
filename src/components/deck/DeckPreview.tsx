import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaFileAlt, FaLayerGroup, FaPencilAlt, FaBolt, FaExclamationTriangle, FaChartBar } from 'react-icons/fa';
import { Card } from '../../types/Card';
import { Deck, DeckFormat, DeckRelatedToken } from '../../types/Deck';
import { CardSize } from '../../types';
import { validateDeck } from '../../utils/deckValidator';
import { useDeckPreviewState } from '../../hooks/useDeckPreviewState';
import { DeckFormatType, DeckZone } from '../../types/enums';
import { formatLabelKey } from '../../utils/formatLabel';
import { useTokenHandlers } from '../../hooks/useTokenHandlers';
import { useDeckStore } from '../../store/useDeckStore';
import EmptyState from '../ui/EmptyState';
import DeckValidationBadge from './DeckValidationBadge';
import DeckFloatingPreview from '../deck/DeckFloatingPreview';
import DeckZoneTabs from '../deck/DeckZoneTabs';
import DeckActionBar from '../deck/DeckActionBar';
import DeckNotesEditor from '../deck/DeckNotesEditor';
import DeckCardList from '../deck/DeckCardList';
import DeckStackView from '../deck/DeckStackView';
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

  const pendingAction = useDeckStore((state) => state.pendingAction);
  const setPendingAction = useDeckStore((state) => state.setPendingAction);

  useEffect(() => {
    if (pendingAction === 'playtest-deck') {
      setIsPlaytestOpen(true);
      setPendingAction(null);
    } else if (pendingAction === 'print-proxies') {
      setIsProxyPrintOpen(true);
      setPendingAction(null);
    }
  }, [pendingAction, setIsPlaytestOpen, setIsProxyPrintOpen, setPendingAction]);

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

  if (selectedDeck) {
    const validation = validateDeck(selectedDeck.cards, selectedDeck.format || DeckFormatType.FREEFORM);

    return (
      <div className="deck-preview-section relative">
        <div className="panel-header relative z-50">
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="text-gray-900 dark:text-white text-xl font-bold transition-colors duration-300 flex items-center gap-2 min-w-0">
                <FaFileAlt className="text-primary shrink-0" />
                <span className="truncate">{selectedDeck.name}</span>
              </h3>
              {onEditInfo ? (
                <button
                  type="button"
                  onClick={() => onEditInfo(selectedDeck)}
                  className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-primary hover:bg-primary/10 transition-all cursor-pointer"
                  title={t('deck.editDeckInfo')}
                  aria-label={t('deck.editDeckInfo')}
                >
                  <FaPencilAlt className="text-xs" />
                </button>
              ) : null}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-muted">
                {t('validation.format')}:{' '}
                <span className="font-semibold text-gray-800 dark:text-gray-200">
                  {t(formatLabelKey(selectedDeck.format))}
                </span>
              </span>
              <span className="text-muted">•</span>
              <span className="text-muted">
                {selectedDeck.cards.length} {t('common.cards')}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
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
              selectedDeck={selectedDeck}
              showToast={showToast}
              onPlaytest={handleOpenPlaytest}
              onPrintProxies={handleOpenProxyPrint}
              onLoadDeckToEdit={handleLoadSelectedDeckToEdit}
              onDeselectDeck={onDeselectDeck}
            />
          </div>
        </div>

        <div className="mb-4 flex flex-col gap-3">
          <DeckValidationBadge validation={validation} formatKey={selectedDeck.format || DeckFormatType.FREEFORM} />
          <DeckCollectionSummary cards={selectedDeck.cards} />
        </div>

        {noteTabHeader}

        {activeNoteTab === 'notes' ? (
          <DeckNotesEditor
            initialNotes={selectedDeck.notes || ''}
            isEditable={true}
            onSave={(notes) => onSaveNotesDirectly?.(selectedDeck.id, notes)}
          />
        ) : activeNoteTab === 'stats' ? (
          <Suspense
            fallback={
              <div className="p-8 text-center text-slate-500 dark:text-slate-400">{t('common.loading')}...</div>
            }
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
        ) : (
          renderCards(false)
        )}

        {viewMode === 'list' && activeNoteTab === 'cards' && hoveredCard ? (
          <DeckFloatingPreview card={hoveredCard} mousePos={mousePos} />
        ) : null}

        <DeckPreviewOverlays
          cards={activeCards}
          isPlaytestOpen={isPlaytestOpen}
          onClosePlaytest={handleClosePlaytest}
          isProxyPrintOpen={isProxyPrintOpen}
          onCloseProxyPrint={handleCloseProxyPrint}
          deckFormat={selectedDeck.format || DeckFormatType.FREEFORM}
          deckName={selectedDeck.name}
          deckRelatedTokens={deckRelatedTokens || selectedDeck?.relatedTokens}
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
            deckCards={activeTokens.map((t) => t.tokenCard)}
            isEditMode={false}
            deckRelatedTokens={activeTokens}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={`deck-preview-section relative ${editingDeckId ? 'border-l-4 border-amber-400 dark:border-amber-500 pl-3' : ''}`}
    >
      <div className="panel-header relative z-50">
        <div>
          {editingDeckId ? (
            <>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="editing-mode-badge">
                  <FaBolt className="text-[9px] shrink-0" />
                  {t('deck.activeEditingMode')}
                </span>
              </div>
              {activeCards.length > 0 ? (
                <h3 className="text-gray-900 dark:text-white text-xl font-bold transition-colors duration-300 text-left truncate">
                  {activeCards.length} {t('common.cards')}
                </h3>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-left leading-snug">
                  {t('deck.addCardsMessage')}
                </p>
              )}
            </>
          ) : (
            <>
              <h3 className="text-gray-900 dark:text-white text-xl font-serif font-semibold transition-colors duration-300 text-left">
                {t('deck.currentDeck')}
              </h3>
              {currentDeck.length > 0 ? (
                <span className="unsaved-deck-chip">
                  <FaExclamationTriangle className="text-rose-500 dark:text-rose-400 text-[9px] shrink-0" />
                  <span>{t('deck.temporaryUnsavedDeck')}</span>
                </span>
              ) : null}
            </>
          )}
        </div>
        {currentDeck.length > 0 ? (
          <div className="flex flex-wrap gap-2 items-center">
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
            />
          </div>
        ) : null}
      </div>

      {currentDeck.length > 0 ? (
        <div className="mb-4 flex flex-col gap-3">
          <DeckValidationBadge
            validation={validateDeck(currentDeck, activeFormat || DeckFormatType.FREEFORM)}
            formatKey={activeFormat || DeckFormatType.FREEFORM}
          />
          <DeckCollectionSummary cards={currentDeck} />
        </div>
      ) : null}

      {noteTabHeader}

      {activeNoteTab === 'notes' ? (
        <DeckNotesEditor initialNotes={editingDeckNotes} isEditable={true} onSave={onUpdateNotes} />
      ) : (
        <>
          {currentDeck.length === 0 ? (
            <EmptyState
              icon={<FaLayerGroup />}
              title={t('deck.emptyDeck')}
              description={t('deck.addCardsMessage')}
              action={{
                label: t('search.searchForCards'),
                onClick: () => {
                  const setPendingAction = useDeckStore.getState().setPendingAction;
                  setPendingAction('focus-search');
                  document.getElementById('nav-search-btn')?.click(); // Fallback for changing tab, as activeTab is in App state
                }
              }}
            />
          ) : (
            renderCards(true)
          )}
        </>
      )}

      {isStatsModalOpen ? (
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
        deckFormat={activeFormat}
        deckRelatedTokens={deckRelatedTokens}
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
          deckCards={activeTokens.map((t) => t.tokenCard)}
          onSelectPrint={handleUpdateTokenCard}
          onRemoveFromDeck={handleDeleteTokenCard}
          onAddToDeck={handleAddTokenCardCopy}
          onAddTokenToDeck={handleAddTokenCardCopy}
          isEditMode={true}
          deckRelatedTokens={activeTokens}
        />
      ) : null}
    </div>
  );
}

export default DeckPreview;
