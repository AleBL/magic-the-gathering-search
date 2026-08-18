import { useTranslation } from 'react-i18next';
import { FaLayerGroup, FaPencilAlt, FaChartBar } from 'react-icons/fa';

export type DeckPreviewNoteTab = 'cards' | 'stats' | 'notes';

interface DeckPreviewNoteTabsProps {
  readonly activeNoteTab: DeckPreviewNoteTab;
  readonly isStatsTabActive: boolean;
  readonly onSelectCardsTab: () => void;
  readonly onSelectStatsTab: () => void;
  readonly onSelectNotesTab: () => void;
}

/** The cards / stats / notes tab bar above a deck's content. */
export function DeckPreviewNoteTabs({
  activeNoteTab,
  isStatsTabActive,
  onSelectCardsTab,
  onSelectStatsTab,
  onSelectNotesTab
}: DeckPreviewNoteTabsProps) {
  const { t } = useTranslation();

  return (
    <div className="deck-content-tab-bar">
      <button
        type="button"
        onClick={onSelectCardsTab}
        className={`deck-content-tab ${activeNoteTab === 'cards' ? 'deck-content-tab-active' : ''}`}
      >
        <FaLayerGroup className="text-[11px]" /> {t('deck.currentDeck')}
      </button>
      <button
        type="button"
        onClick={onSelectStatsTab}
        className={`deck-content-tab ${isStatsTabActive ? 'deck-content-tab-active' : ''}`}
      >
        <FaChartBar className="text-[11px]" /> {t('stats.deckStats')}
      </button>
      <button
        type="button"
        onClick={onSelectNotesTab}
        className={`deck-content-tab ${activeNoteTab === 'notes' ? 'deck-content-tab-active' : ''}`}
      >
        <FaPencilAlt className="text-[11px]" /> {t('strategy.strategyGuide')}
      </button>
    </div>
  );
}

export default DeckPreviewNoteTabs;
