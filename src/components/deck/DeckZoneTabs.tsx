import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DeckZone } from '../../types/enums';

interface DeckZoneTabsProps {
  mainCount: number;
  sideCount: number;
  maybeCount: number;
  tokensCount: number;
  activeZone: DeckZone;
  onZoneChange: (zone: DeckZone) => void;
  onUpdateCardZone?: (cardId: string, zone: 'main' | 'sideboard' | 'maybeboard') => void;
}

function DeckZoneTabs({
  mainCount,
  sideCount,
  maybeCount,
  tokensCount,
  activeZone,
  onZoneChange,
  onUpdateCardZone
}: DeckZoneTabsProps) {
  const { t } = useTranslation();
  const [dragOverZone, setDragOverZone] = useState<string | null>(null);

  const tabClass = (zone: string) => {
    const isActive = activeZone === zone;
    const isDragTarget = dragOverZone === zone;

    return [
      'px-3 py-1.5 rounded-t-lg transition-all text-xs font-semibold relative',
      isActive
        ? 'bg-primary text-white font-extrabold shadow-sm'
        : 'bg-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300',
      isDragTarget
        ? 'ring-2 ring-indigo-400 ring-offset-1 dark:ring-offset-slate-900 bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 font-extrabold scale-105 shadow-lg shadow-indigo-500/20'
        : ''
    ].join(' ');
  };

  const handleDragOver = (e: React.DragEvent<HTMLButtonElement>, zone: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverZone !== zone) {
      setDragOverZone(zone);
    }
  };

  const handleDragLeave = () => {
    setDragOverZone(null);
  };

  const handleDrop = (e: React.DragEvent<HTMLButtonElement>, zone: 'main' | 'sideboard' | 'maybeboard') => {
    e.preventDefault();
    setDragOverZone(null);
    const cardId = e.dataTransfer.getData('text/plain');
    if (cardId && onUpdateCardZone) {
      onUpdateCardZone(cardId, zone);
    }
  };

  return (
    <div className="flex flex-wrap border-b border-gray-200 dark:border-slate-800 mb-4 text-xs font-semibold gap-1.5 select-none">
      <button
        type="button"
        onClick={() => onZoneChange('main')}
        className={tabClass('main')}
        onDragOver={(e) => handleDragOver(e, 'main')}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, 'main')}
      >
        {dragOverZone === 'main' && (
          <span className="absolute inset-0 rounded-t-lg border-2 border-dashed border-indigo-400 animate-pulse pointer-events-none" />
        )}
        {t('strategy.mainDeck')} ({mainCount})
      </button>
      <button
        type="button"
        onClick={() => onZoneChange('sideboard')}
        className={tabClass('sideboard')}
        onDragOver={(e) => handleDragOver(e, 'sideboard')}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, 'sideboard')}
      >
        {dragOverZone === 'sideboard' && (
          <span className="absolute inset-0 rounded-t-lg border-2 border-dashed border-purple-400 animate-pulse pointer-events-none" />
        )}
        {t('strategy.sideboard')} ({sideCount})
      </button>
      <button
        type="button"
        onClick={() => onZoneChange('maybeboard')}
        className={tabClass('maybeboard')}
        onDragOver={(e) => handleDragOver(e, 'maybeboard')}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, 'maybeboard')}
      >
        {dragOverZone === 'maybeboard' && (
          <span className="absolute inset-0 rounded-t-lg border-2 border-dashed border-amber-400 animate-pulse pointer-events-none" />
        )}
        {t('strategy.maybeboard')} ({maybeCount})
      </button>
      <button type="button" onClick={() => onZoneChange('tokens')} className={tabClass('tokens')}>
        {t('tokens.tokensTab')} ({tokensCount})
      </button>
    </div>
  );
}

export default DeckZoneTabs;
