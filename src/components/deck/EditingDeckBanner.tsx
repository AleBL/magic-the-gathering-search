import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaBolt, FaTimes } from 'react-icons/fa';
import { useDeckStore } from '../../store/useDeckStore';
import { DeckFormat } from '../../types/Deck';
import { DeckFormatType } from '../../types/enums';
import { formatLabelKey } from '../../utils/formatLabel';

interface EditingDeckBannerProps {
  deckName: string;
  deckFormat: string;
  onCancelEdit: () => void;
}

function EditingDeckBanner({ deckName, deckFormat, onCancelEdit }: EditingDeckBannerProps) {
  const { t } = useTranslation();
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingFormat, setIsEditingFormat] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const formatSelectRef = useRef<HTMLSelectElement>(null);

  const updateDeckName = useDeckStore((state) => state.updateDeckName);
  const updateDeckFormat = useDeckStore((state) => state.updateDeckFormat);

  useEffect(() => {
    if (isEditingName) nameInputRef.current?.focus();
  }, [isEditingName]);

  useEffect(() => {
    if (isEditingFormat) formatSelectRef.current?.focus();
  }, [isEditingFormat]);

  return (
    <div className="editing-banner">
      {/* Left: Status indicator + deck info */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <span className="banner-status-dot shrink-0" />
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-400 dark:text-amber-300 flex items-center gap-1 leading-none mb-0.5">
            <FaBolt className="text-[8px] shrink-0" />
            {t('deck.editingDeck')}
          </span>
          <div className="flex items-center gap-2 w-full min-w-0">
            {isEditingName ? (
              <input
                ref={nameInputRef}
                type="text"
                value={deckName}
                onChange={(e) => updateDeckName(e.target.value)}
                onBlur={(e) => {
                  setIsEditingName(false);
                  if (!e.target.value.trim()) updateDeckName(t('deck.unnamedDeck'));
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === 'Escape') {
                    e.currentTarget.blur();
                  }
                }}
                className="bg-slate-800/80 text-white text-sm font-bold border border-slate-500 rounded px-2 py-0.5 w-1/3 min-w-[120px] focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
            ) : (
              <button
                type="button"
                className="font-bold text-sm text-white flex items-baseline leading-tight min-w-0 gap-2 truncate flex-shrink cursor-pointer hover:text-amber-300 transition-colors text-left"
                onClick={() => setIsEditingName(true)}
                title={t('deck.editDeckInfo')}
              >
                {deckName}
              </button>
            )}

            {isEditingFormat ? (
              <select
                ref={formatSelectRef}
                value={deckFormat}
                onChange={(e) => {
                  updateDeckFormat(e.target.value as DeckFormat);
                  setIsEditingFormat(false);
                }}
                onBlur={() => setIsEditingFormat(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape' || e.key === 'Enter') {
                    setIsEditingFormat(false);
                  }
                }}
                className="bg-slate-800 text-amber-200 text-xs font-bold border border-amber-500/50 rounded px-1 py-0.5 uppercase focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 cursor-pointer shadow-lg"
              >
                <option value="standard" className="bg-slate-800 text-amber-200">
                  {t('validation.standard')}
                </option>
                <option value="modern" className="bg-slate-800 text-amber-200">
                  {t('validation.modern')}
                </option>
                <option value="commander" className="bg-slate-800 text-amber-200">
                  {t('validation.commander')}
                </option>
                <option value="vintage" className="bg-slate-800 text-amber-200">
                  {t('validation.vintage')}
                </option>
                <option value="pauper" className="bg-slate-800 text-amber-200">
                  {t('validation.pauper')}
                </option>
                <option value={DeckFormatType.FREEFORM} className="bg-slate-800 text-amber-200">
                  {t('validation.freeform')}
                </option>
              </select>
            ) : (
              <button
                type="button"
                className="text-[10px] bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 px-1.5 py-0.5 rounded uppercase font-bold shrink-0 border border-amber-500/30 cursor-pointer transition-colors"
                onClick={() => setIsEditingFormat(true)}
                title={t('deck.editDeckInfo')}
              >
                {t(formatLabelKey(deckFormat))}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Right: Action buttons - cancel icon only with tooltip */}
      <div className="flex gap-1.5 shrink-0">
        <div className="relative group/tooltip inline-flex items-center">
          <button
            type="button"
            onClick={onCancelEdit}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-red-500/20 hover:bg-red-500/40 text-red-200 hover:text-white transition-all border border-red-500/30 active:scale-95 shadow-sm"
            aria-label={t('deck.exitEditMode')}
          >
            <FaTimes className="text-xs shrink-0" />
          </button>
          <div className="absolute right-0 top-full mt-2 w-32 p-2 bg-slate-900 dark:bg-slate-950 text-white text-xs text-center rounded-lg shadow-xl border border-slate-700 dark:border-slate-800 opacity-0 pointer-events-none group-hover/tooltip:opacity-100 transition-all duration-300 z-50 transform translate-y-1 group-hover/tooltip:translate-y-0">
            <p className="font-medium leading-none">{t('deck.exitEditMode')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EditingDeckBanner;
