import { useTranslation } from 'react-i18next';
import { FaSkull, FaBan } from 'react-icons/fa';
import { usePlaytestContext } from './PlaytestContext';
import { PlaytestBattlefieldContextMenu } from './PlaytestBattlefieldContextMenu';
import PileExplorerModal from './PileExplorerModal';
import ScrySurveilModal from './ScrySurveilModal';
import { PlaytestTokenModal } from './PlaytestTokenModal';
import CardDetailModal from '../card/CardDetailModal';
import { PlaytestCard } from '../../types/Playtest';
import { DeckRelatedToken } from '../../types/Deck';
import { PlaytestZone } from '../../types/enums';
import { PLAYTEST_CARD_DETAIL_Z_INDEX } from '../../constants';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useEscapeKey } from '../../hooks/useEscapeKey';

export function PlaytestModals({ deckRelatedTokens }: { deckRelatedTokens: DeckRelatedToken[] }) {
  const { t } = useTranslation();
  const {
    contextMenu,
    setContextMenu,
    libraryContextMenu,
    setLibraryContextMenu,
    positionPrompt,
    setPositionPrompt,
    scrySurveilPrompt,
    setScrySurveilPrompt,
    pileExplorerConfig,
    setPileExplorerConfig,
    scrySurveilConfig,
    setScrySurveilConfig,
    isTokenModalOpen,
    setIsTokenModalOpen,
    selectedDetailCard,
    setSelectedDetailCard,
    handleSendToLibraryPosition,
    handleDiscardFromHand,
    handleSendToExile,
    handleSummonToken,
    moveCard,
    library,
    graveyard,
    exile,
    setLibrary,
    setGraveyard,
    logAction,
    getCardImageUrl
  } = usePlaytestContext();

  const scrySurveilDialogRef = useFocusTrap<HTMLDivElement>(!!scrySurveilPrompt);
  useEscapeKey(() => setScrySurveilPrompt(null), !!scrySurveilPrompt);

  const positionDialogRef = useFocusTrap<HTMLDivElement>(!!positionPrompt);
  useEscapeKey(() => setPositionPrompt(null), !!positionPrompt);

  const contextMenuRef = useFocusTrap<HTMLDivElement>(!!contextMenu);
  useEscapeKey(() => setContextMenu(null), !!contextMenu);

  const libraryContextMenuRef = useFocusTrap<HTMLDivElement>(!!libraryContextMenu);
  useEscapeKey(() => setLibraryContextMenu(null), !!libraryContextMenu);

  return (
    <>
      {/* Context Menu Overlay */}
      {contextMenu && (
        // Only guards against bubbling to the outer close-on-click handler; the buttons inside are the real interactive surface.
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
        <div
          ref={contextMenuRef}
          className="fixed z-[var(--z-playtest-menu)] bg-slate-900 border border-slate-700 shadow-2xl rounded-xl py-1 w-48 animate-fadeIn"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(event) => event.stopPropagation()}
        >
          {contextMenu.zone === 'battlefield' && <PlaytestBattlefieldContextMenu playtestId={contextMenu.playtestId} />}

          {contextMenu.zone === 'hand' && (
            <>
              <button
                type="button"
                className="w-full text-left px-4 py-2 hover:bg-slate-800 text-sm text-slate-200 font-medium transition-colors cursor-pointer"
                onClick={() => {
                  handleSendToLibraryPosition(contextMenu.playtestId, 0);
                  setContextMenu(null);
                }}
              >
                {t('playtest.toLibraryTop')}
              </button>
              <button
                type="button"
                className="w-full text-left px-4 py-2 hover:bg-slate-800 text-sm text-slate-200 font-medium transition-colors cursor-pointer"
                onClick={() => {
                  handleSendToLibraryPosition(contextMenu.playtestId, library.length);
                  setContextMenu(null);
                }}
              >
                {t('playtest.toLibraryBottom')}
              </button>
              <button
                type="button"
                className="w-full text-left px-4 py-2 hover:bg-slate-800 text-sm text-slate-200 font-medium transition-colors cursor-pointer"
                onClick={() => {
                  setPositionPrompt({ playtestId: contextMenu.playtestId });
                  setContextMenu(null);
                }}
              >
                {t('playtest.toLibraryPosition')}
              </button>
              <div className="h-px bg-slate-800 my-1"></div>
              <button
                type="button"
                className="w-full text-left px-4 py-2 hover:bg-slate-800 text-sm text-red-400 font-medium transition-colors flex items-center gap-2 cursor-pointer"
                onClick={() => {
                  handleDiscardFromHand(contextMenu.playtestId);
                  setContextMenu(null);
                }}
              >
                <FaSkull className="text-xs" />
                {t('playtest.discardCard')}
              </button>
              <button
                type="button"
                className="w-full text-left px-4 py-2 hover:bg-slate-800 text-sm text-slate-200 font-medium transition-colors flex items-center gap-2 cursor-pointer"
                onClick={() => {
                  handleSendToExile(contextMenu.playtestId, PlaytestZone.HAND);
                  setContextMenu(null);
                }}
              >
                <FaBan className="text-xs" />
                {t('playtest.moveToExile')}
              </button>
            </>
          )}
        </div>
      )}

      {/* Library Context Menu */}
      {libraryContextMenu && (
        // Only guards against bubbling to the outer close-on-click handler; the buttons inside are the real interactive surface.
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
        <div
          ref={libraryContextMenuRef}
          className="fixed z-[var(--z-playtest-menu)] bg-slate-800 border border-slate-700 shadow-2xl rounded-xl py-1 w-48 animate-fadeIn"
          style={{ top: libraryContextMenu.y, left: libraryContextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full text-left px-4 py-2 hover:bg-slate-700 text-sm text-slate-200 transition-colors cursor-pointer"
            onClick={() => {
              setPileExplorerConfig({ title: t('playtest.library'), pile: 'library' });
              setLibraryContextMenu(null);
            }}
          >
            {t('playtest.viewLibrary')}
          </button>
          <button
            className="w-full text-left px-4 py-2 hover:bg-slate-700 text-sm text-slate-200 transition-colors cursor-pointer"
            onClick={() => {
              setScrySurveilPrompt({ type: 'scry' });
              setLibraryContextMenu(null);
            }}
          >
            {t('playtest.scry')}...
          </button>
          <button
            className="w-full text-left px-4 py-2 hover:bg-slate-700 text-sm text-slate-200 transition-colors cursor-pointer"
            onClick={() => {
              setScrySurveilPrompt({ type: 'surveil' });
              setLibraryContextMenu(null);
            }}
          >
            {t('playtest.surveil')}...
          </button>
        </div>
      )}

      {/* Scry/Surveil Prompt */}
      {scrySurveilPrompt && (
        <div className="fixed inset-0 z-[var(--z-playtest-dialog)] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div
            ref={scrySurveilDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="scry-surveil-prompt-title"
            className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-6 flex flex-col gap-4"
          >
            <h3 id="scry-surveil-prompt-title" className="text-lg font-bold text-slate-200">
              {t('playtest.promptAmount', { action: t(`playtest.${scrySurveilPrompt.type}`) })}
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const amount = parseInt(formData.get('amount') as string, 10);
                if (!isNaN(amount) && amount > 0) {
                  setScrySurveilConfig({ type: scrySurveilPrompt.type, amount });
                }
                setScrySurveilPrompt(null);
              }}
              className="flex flex-col gap-4"
            >
              <input
                name="amount"
                type="number"
                min="1"
                defaultValue="1"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
              <div className="flex gap-3 justify-end mt-2">
                <button
                  type="button"
                  onClick={() => setScrySurveilPrompt(null)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg transition-colors cursor-pointer"
                >
                  {t('common.confirm')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Position Prompt */}
      {positionPrompt && (
        <div className="fixed inset-0 z-[var(--z-playtest-dialog)] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div
            ref={positionDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="position-prompt-title"
            className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-6 flex flex-col gap-4"
          >
            <h3 id="position-prompt-title" className="text-lg font-bold text-slate-200">
              {t('playtest.toLibraryPosition')}
            </h3>
            <p className="text-sm text-slate-400">{t('export.positionPrompt')}</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const pos = parseInt(formData.get('position') as string, 10);
                if (!isNaN(pos)) {
                  handleSendToLibraryPosition(positionPrompt.playtestId, Math.max(0, pos - 1));
                }
                setPositionPrompt(null);
              }}
              className="flex flex-col gap-4"
            >
              <input
                name="position"
                type="number"
                min="1"
                defaultValue="1"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
              <div className="flex gap-3 justify-end mt-2">
                <button
                  type="button"
                  onClick={() => setPositionPrompt(null)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg transition-colors cursor-pointer"
                >
                  {t('common.confirm')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pile Explorer Modal */}
      {pileExplorerConfig && (
        <PileExplorerModal
          title={pileExplorerConfig.title}
          cards={
            pileExplorerConfig.pile === 'library' ? library : pileExplorerConfig.pile === 'exile' ? exile : graveyard
          }
          onClose={() => setPileExplorerConfig(null)}
          onMoveCard={(playtestId, destination, placement) => {
            const moved = moveCard(playtestId, pileExplorerConfig.pile, destination, placement);
            if (moved) {
              logAction(
                t('playtest.movedFromPileLog', {
                  name: moved.card.printed_name || moved.card.name,
                  source: t(`playtest.${pileExplorerConfig.pile}`),
                  dest: t(`playtest.${destination}`)
                })
              );
            }
          }}
        />
      )}

      {/* Scry/Surveil Modal */}
      {scrySurveilConfig && (
        <ScrySurveilModal
          type={scrySurveilConfig.type}
          amount={scrySurveilConfig.amount}
          initialCards={library.slice(0, scrySurveilConfig.amount)}
          onClose={() => setScrySurveilConfig(null)}
          onComplete={(topCards, otherCards) => {
            const remainingLibrary = library.slice(scrySurveilConfig.amount);
            setLibrary([...topCards, ...remainingLibrary]);

            if (scrySurveilConfig.type === 'scry') {
              setLibrary((prev: PlaytestCard[]) => [...prev, ...otherCards]);
              logAction(
                t('playtest.scryLog')
                  .replace('{{amount}}', String(scrySurveilConfig.amount))
                  .replace('{{top}}', String(topCards.length))
                  .replace('{{bottom}}', String(otherCards.length))
              );
            } else {
              setGraveyard((prev: PlaytestCard[]) => [...otherCards, ...prev]);
              logAction(
                t('playtest.surveilLog')
                  .replace('{{amount}}', String(scrySurveilConfig.amount))
                  .replace('{{top}}', String(topCards.length))
                  .replace('{{grave}}', String(otherCards.length))
              );
            }

            setScrySurveilConfig(null);
          }}
        />
      )}

      {/* Token Modal */}
      <PlaytestTokenModal
        isOpen={isTokenModalOpen}
        onClose={() => setIsTokenModalOpen(false)}
        onSelectToken={handleSummonToken}
        deckRelatedTokens={deckRelatedTokens}
      />

      {/* Card Details Modal */}
      {selectedDetailCard && (
        <CardDetailModal
          card={selectedDetailCard}
          imageUrl={getCardImageUrl(selectedDetailCard)}
          onClose={() => setSelectedDetailCard(null)}
          hidePrintsSidebar={true}
          hidePriceAndLegality={true}
          zIndex={PLAYTEST_CARD_DETAIL_Z_INDEX}
        />
      )}
    </>
  );
}
