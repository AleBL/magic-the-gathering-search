import { useState, useMemo, useCallback, useEffect } from 'react';
import { Card } from '../types/Card';
import { Deck, DeckFormat, DeckRelatedToken } from '../types/Deck';
import { groupCards, getCardImageUrl } from '../utils/deckGrouping';

import { DeckZone, GroupCriteria, SortCriteria } from '../types/enums';

export type ViewMode = 'list' | 'grid' | 'stack';
export type NoteTab = 'cards' | 'notes' | 'stats';

/** Module-level cache: avoids re-creating `new Image()` for already-seen URLs */
const preloadedUrls = new Set<string>();

interface UseDeckPreviewStateParams {
  selectedDeck: Deck | null;
  currentDeck: Card[];
  activeFormat: DeckFormat | undefined;
  deckRelatedTokens: DeckRelatedToken[] | undefined;
}

export function useDeckPreviewState({
  selectedDeck,
  currentDeck,
  activeFormat,
  deckRelatedTokens
}: UseDeckPreviewStateParams) {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [hoveredCard, setHoveredCard] = useState<Card | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPlaytestOpen, setIsPlaytestOpen] = useState(false);
  const [isProxyPrintOpen, setIsProxyPrintOpen] = useState(false);
  const [activeNoteTab, setActiveNoteTab] = useState<NoteTab>('cards');
  const [activeZone, setActiveZone] = useState<DeckZone>(DeckZone.MAIN);
  const [selectedTokenForView, setSelectedTokenForView] = useState<Card | null>(null);
  const [groupBy, setGroupBy] = useState<GroupCriteria>(GroupCriteria.TYPE);
  const [sortBy, setSortBy] = useState<SortCriteria>(SortCriteria.NAME);
  const [isDisplaySettingsOpen, setIsDisplaySettingsOpen] = useState(false);

  const activeCards = useMemo(() => (selectedDeck ? selectedDeck.cards : currentDeck), [selectedDeck, currentDeck]);

  const isCommanderFormat = useMemo(() => {
    const fmt = selectedDeck ? selectedDeck.format : activeFormat;
    return fmt === 'commander';
  }, [selectedDeck, activeFormat]);

  const commanders = useMemo(
    () => (isCommanderFormat ? activeCards.filter((card) => card.isCommander) : []),
    [activeCards, isCommanderFormat]
  );

  const activeTokens = useMemo(
    () => deckRelatedTokens || selectedDeck?.relatedTokens || [],
    [deckRelatedTokens, selectedDeck]
  );

  const zoneCards = useMemo(() => {
    if (activeZone === DeckZone.TOKENS) {
      return activeTokens.map((token) => ({ ...token.tokenCard, isActive: token.isActive !== false }));
    }
    return activeCards.filter((card) => (card.zone || DeckZone.MAIN) === activeZone);
  }, [activeCards, activeZone, activeTokens]);

  const deckCards = useMemo(
    () =>
      isCommanderFormat && activeZone !== DeckZone.TOKENS ? zoneCards.filter((card) => !card.isCommander) : zoneCards,
    [zoneCards, isCommanderFormat, activeZone]
  );

  const groupedCards = useMemo(() => groupCards(deckCards, groupBy, sortBy), [deckCards, groupBy, sortBy]);

  const zoneCounts = useMemo(
    () => ({
      main: activeCards.filter((card) => !card.zone || card.zone === DeckZone.MAIN).length,
      sideboard: activeCards.filter((card) => card.zone === DeckZone.SIDEBOARD).length,
      maybeboard: activeCards.filter((card) => card.zone === DeckZone.MAYBEBOARD).length,
      tokens: activeTokens.length
    }),
    [activeCards, activeTokens]
  );

  useEffect(() => {
    if (!activeCards || activeCards.length === 0) return;
    const preloadImages = () => {
      activeCards.forEach((card) => {
        const url = getCardImageUrl(card);
        if (url && !preloadedUrls.has(url)) {
          preloadedUrls.add(url);
          const img = new Image();
          img.src = url;
        }
      });
    };
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(preloadImages);
    } else {
      setTimeout(preloadImages, 100);
    }
  }, [activeCards]);

  const handleHoverEnter = useCallback((card: Card, event: React.MouseEvent) => {
    setHoveredCard(card);
    setMousePos({ x: event.clientX, y: event.clientY });
  }, []);

  const handleHoverMove = useCallback((event: React.MouseEvent) => {
    setMousePos({ x: event.clientX, y: event.clientY });
  }, []);

  const handleHoverLeave = useCallback(() => setHoveredCard(null), []);

  return {
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
    isCommanderFormat,
    commanders,
    activeTokens,
    zoneCards,
    deckCards,
    groupedCards,
    zoneCounts,
    handleHoverEnter,
    handleHoverMove,
    handleHoverLeave
  };
}
