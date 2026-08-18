import { useTranslation } from 'react-i18next';
import { usePlaytestContext } from './PlaytestContext';
import { PlaytestCard } from '../../types/Playtest';
import { PlaytestZone } from '../../types/enums';

/** The right-click menu for a battlefield card: counters, face-down, and zone moves. */
export function PlaytestBattlefieldContextMenu({ playtestId }: { readonly playtestId: string }) {
  const { t } = useTranslation();
  const {
    setContextMenu,
    handleAddCounter,
    handleRemoveCounter,
    handleToggleFaceDown,
    handleReturnToHand,
    handleSendToGraveyard,
    handleSendToExile,
    battlefield
  } = usePlaytestContext();

  const isFaceDown = battlefield.find((card: PlaytestCard) => card.playtestId === playtestId)?.isFaceDown;

  return (
    <>
      <button
        type="button"
        className="w-full text-left px-4 py-2 hover:bg-slate-800 text-sm text-slate-200 font-medium transition-colors cursor-pointer"
        onClick={() => {
          handleAddCounter(playtestId);
          setContextMenu(null);
        }}
      >
        {t('playtest.addCounter')}
      </button>
      <button
        type="button"
        className="w-full text-left px-4 py-2 hover:bg-slate-800 text-sm text-slate-200 font-medium transition-colors cursor-pointer"
        onClick={() => {
          handleRemoveCounter(playtestId);
          setContextMenu(null);
        }}
      >
        {t('playtest.removeCounter')}
      </button>
      <div className="h-px bg-slate-800 my-1"></div>
      <button
        type="button"
        className="w-full text-left px-4 py-2 hover:bg-slate-800 text-sm text-slate-200 font-medium transition-colors cursor-pointer"
        onClick={() => {
          handleToggleFaceDown(playtestId);
          setContextMenu(null);
        }}
      >
        {isFaceDown ? t('playtest.toggleFaceUp') : t('playtest.toggleFaceDown')}
      </button>
      <div className="h-px bg-slate-800 my-1"></div>
      <button
        type="button"
        className="w-full text-left px-4 py-2 hover:bg-slate-800 text-sm text-slate-200 font-medium transition-colors cursor-pointer"
        onClick={() => {
          handleReturnToHand(playtestId, PlaytestZone.BATTLEFIELD);
          setContextMenu(null);
        }}
      >
        {t('playtest.returnToHand')}
      </button>
      <button
        type="button"
        className="w-full text-left px-4 py-2 hover:bg-slate-800 text-sm text-slate-200 font-medium transition-colors cursor-pointer"
        onClick={() => {
          handleSendToGraveyard(playtestId);
          setContextMenu(null);
        }}
      >
        {t('playtest.moveToGraveyard')}
      </button>
      <button
        type="button"
        className="w-full text-left px-4 py-2 hover:bg-slate-800 text-sm text-slate-200 font-medium transition-colors cursor-pointer"
        onClick={() => {
          handleSendToExile(playtestId, PlaytestZone.BATTLEFIELD);
          setContextMenu(null);
        }}
      >
        {t('playtest.moveToExile')}
      </button>
    </>
  );
}

export default PlaytestBattlefieldContextMenu;
