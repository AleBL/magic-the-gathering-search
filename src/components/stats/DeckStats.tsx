import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaTimes } from 'react-icons/fa';
import { Card } from '../../types/Card';
import CardItem from '../card/CardItem';
import { computeDeckStatistics, filterCardsByStat, StatFilter } from '../../utils/deckStatistics';
import { useColorLabels } from '../stats/colorLabels';
import { ManaCurvePanel } from '../stats/ManaCurvePanel';
import { ColorDistributionPanel } from '../stats/ColorDistributionPanel';
import { TypesBreakdownPanel } from '../stats/TypesBreakdownPanel';
import { ManaBaseOptimizerPanel } from '../stats/ManaBaseOptimizerPanel';
import { ManaPipAnalysisPanel } from '../stats/ManaPipAnalysisPanel';
import { BudgetEstimatorPanel } from '../stats/BudgetEstimatorPanel';
import { RarityPanel } from '../stats/RarityPanel';
import { DeckDoctorPanel } from '../stats/DeckDoctorPanel';

interface DeckStatsProps {
  currentDeck: Card[];
  onApplySuggestedLands?: (landCounts: Record<string, number>) => void;
  renderFilteredCards?: (cards: Card[]) => React.ReactNode;
}

function DeckStats({ currentDeck, onApplySuggestedLands, renderFilteredCards }: DeckStatsProps) {
  const { t } = useTranslation();
  const [activeFilter, setActiveFilter] = useState<StatFilter | null>(null);
  const colorLabels = useColorLabels();

  const filteredCards = useMemo(() => filterCardsByStat(currentDeck, activeFilter), [currentDeck, activeFilter]);
  const stats = useMemo(() => computeDeckStatistics(currentDeck), [currentDeck]);

  if (currentDeck.length === 0) return null;

  return (
    <div className="deck-stats-container">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <DeckDoctorPanel currentDeck={currentDeck} stats={stats} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <ManaCurvePanel stats={stats} activeFilter={activeFilter} setActiveFilter={setActiveFilter} />
        <ColorDistributionPanel
          stats={stats}
          colorLabels={colorLabels}
          activeFilter={activeFilter}
          setActiveFilter={setActiveFilter}
        />
        <TypesBreakdownPanel stats={stats} activeFilter={activeFilter} setActiveFilter={setActiveFilter} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-gray-200 dark:border-gray-700 mt-6 text-left">
        <ManaBaseOptimizerPanel stats={stats} onApplySuggestedLands={onApplySuggestedLands} />
        <ManaPipAnalysisPanel stats={stats} colorLabels={colorLabels} />
        <BudgetEstimatorPanel stats={stats} />
      </div>

      <div className="grid grid-cols-1 gap-6 pt-6 border-t border-gray-200 dark:border-gray-700 mt-6 text-left">
        <RarityPanel stats={stats} />
      </div>

      {activeFilter ? (
        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700 animate-fadeIn">
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-bold text-lg text-gray-800 dark:text-gray-200">
              {t('search.filteredCards')} ({filteredCards.length})
            </h4>
            <button
              onClick={() => setActiveFilter(null)}
              className="text-xs flex items-center gap-1.5 text-gray-500 hover:text-red-500 dark:hover:text-red-400 font-semibold px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg transition-colors"
            >
              <FaTimes />
              {t('search.clearFilter')}
            </button>
          </div>
          {renderFilteredCards ? (
            renderFilteredCards(filteredCards)
          ) : (
            <div className="flex flex-wrap gap-2">
              {filteredCards.map((card) => (
                <div key={card.id} className="w-[146px] shrink-0">
                  <CardItem card={card} size="small" />
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default DeckStats;
