import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PlaytestCard } from '../../types/Playtest';
import { FaTimes, FaArrowLeft, FaArrowRight, FaArrowDown, FaArrowUp } from 'react-icons/fa';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useEscapeKey } from '../../hooks/useEscapeKey';

export interface ScrySurveilModalProps {
  type: 'scry' | 'surveil';
  amount: number;
  initialCards: PlaytestCard[];
  onComplete: (topCards: PlaytestCard[], bottomOrGraveyardCards: PlaytestCard[]) => void;
  onClose: () => void;
}

export default function ScrySurveilModal({ type, amount, initialCards, onComplete, onClose }: ScrySurveilModalProps) {
  const { t } = useTranslation();
  const [topCards, setTopCards] = useState<PlaytestCard[]>(initialCards);
  const [otherCards, setOtherCards] = useState<PlaytestCard[]>([]);
  const dialogRef = useFocusTrap<HTMLDivElement>(true);
  useEscapeKey(onClose);

  const title = type === 'scry' ? t('playtest.scryAmount', { amount }) : t('playtest.surveilAmount', { amount });
  const otherZoneName = type === 'scry' ? t('playtest.bottomOfLibrary') : t('playtest.graveyard');

  const moveToOther = (cardId: string) => {
    const card = topCards.find((card) => card.playtestId === cardId);
    if (card) {
      setTopCards((prev) => prev.filter((card) => card.playtestId !== cardId));
      setOtherCards((prev) => [...prev, card]);
    }
  };

  const moveToTop = (cardId: string) => {
    const card = otherCards.find((card) => card.playtestId === cardId);
    if (card) {
      setOtherCards((prev) => prev.filter((card) => card.playtestId !== cardId));
      setTopCards((prev) => [...prev, card]);
    }
  };

  const moveLeft = (
    cardId: string,
    list: PlaytestCard[],
    setList: React.Dispatch<React.SetStateAction<PlaytestCard[]>>
  ) => {
    const idx = list.findIndex((card) => card.playtestId === cardId);
    if (idx > 0) {
      const newList = [...list];
      [newList[idx - 1], newList[idx]] = [newList[idx], newList[idx - 1]];
      setList(newList);
    }
  };

  const moveRight = (
    cardId: string,
    list: PlaytestCard[],
    setList: React.Dispatch<React.SetStateAction<PlaytestCard[]>>
  ) => {
    const idx = list.findIndex((card) => card.playtestId === cardId);
    if (idx < list.length - 1) {
      const newList = [...list];
      [newList[idx], newList[idx + 1]] = [newList[idx + 1], newList[idx]];
      setList(newList);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 3000 }}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="scry-surveil-title"
        className="w-full max-w-5xl mx-4 bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] animate-fadeIn"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 id="scry-surveil-title" className="text-2xl font-bold text-slate-900 dark:text-white">
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label={t('common.close')}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <FaTimes className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-8 custom-scrollbar pr-2 pb-4">
          <div className="bg-slate-100 dark:bg-slate-800/50 p-6 rounded-xl border border-slate-300 dark:border-slate-700">
            <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-4">
              {t('playtest.topOfLibrary')}{' '}
              <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
                ({t('playtest.leftIsTop')})
              </span>
            </h3>
            <div className="flex flex-wrap gap-4 min-h-[16rem] items-center">
              {topCards.length === 0 && (
                <p className="text-slate-500 dark:text-slate-500 w-full text-center">{t('playtest.noCards')}</p>
              )}
              {topCards.map((card, i) => (
                <div key={card.playtestId} className="flex flex-col items-center gap-2 w-32">
                  <div className="flex gap-1 w-full justify-center">
                    <button
                      type="button"
                      disabled={i === 0}
                      onClick={() => moveLeft(card.playtestId, topCards, setTopCards)}
                      className="p-1 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-50 rounded text-slate-700 dark:text-white cursor-pointer"
                    >
                      <FaArrowLeft className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      disabled={i === topCards.length - 1}
                      onClick={() => moveRight(card.playtestId, topCards, setTopCards)}
                      className="p-1 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-50 rounded text-slate-700 dark:text-white cursor-pointer"
                    >
                      <FaArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                  <img
                    src={card.card.image_uris?.normal || card.card.card_faces?.[0]?.image_uris?.normal || ''}
                    alt={card.card.name}
                    className="w-full rounded-xl shadow-md"
                  />
                  <button
                    type="button"
                    onClick={() => moveToOther(card.playtestId)}
                    className="mt-1 px-2 py-1 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-sm text-slate-800 dark:text-white rounded w-full flex justify-center items-center gap-1 cursor-pointer"
                  >
                    <FaArrowDown className="w-3 h-3" /> {otherZoneName}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-100 dark:bg-slate-800/50 p-6 rounded-xl border border-slate-300 dark:border-slate-700">
            <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-4">
              {otherZoneName}{' '}
              <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
                ({t('playtest.leftIsTop')})
              </span>
            </h3>
            <div className="flex flex-wrap gap-4 min-h-[16rem] items-center">
              {otherCards.length === 0 && <p className="text-slate-500 w-full text-center">{t('playtest.noCards')}</p>}
              {otherCards.map((card, i) => (
                <div key={card.playtestId} className="flex flex-col items-center gap-2 w-32">
                  <button
                    type="button"
                    onClick={() => moveToTop(card.playtestId)}
                    className="mb-1 px-2 py-1 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-sm text-slate-800 dark:text-white rounded w-full flex justify-center items-center gap-1 cursor-pointer"
                  >
                    <FaArrowUp className="w-3 h-3" /> {t('playtest.topOfLibrary')}
                  </button>
                  <img
                    src={card.card.image_uris?.normal || card.card.card_faces?.[0]?.image_uris?.normal || ''}
                    alt={card.card.name}
                    className="w-full rounded-xl shadow-md"
                  />
                  <div className="flex gap-1 w-full justify-center">
                    <button
                      type="button"
                      disabled={i === 0}
                      onClick={() => moveLeft(card.playtestId, otherCards, setOtherCards)}
                      className="p-1 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-50 rounded text-slate-800 dark:text-white cursor-pointer"
                    >
                      <FaArrowLeft className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      disabled={i === otherCards.length - 1}
                      onClick={() => moveRight(card.playtestId, otherCards, setOtherCards)}
                      className="p-1 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-50 rounded text-slate-800 dark:text-white cursor-pointer"
                    >
                      <FaArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium cursor-pointer"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={() => onComplete(topCards, otherCards)}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors cursor-pointer"
          >
            {t('common.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
