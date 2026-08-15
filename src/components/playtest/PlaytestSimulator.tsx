import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { FaExclamationTriangle, FaCheck } from 'react-icons/fa';

import { Card } from '../../types/Card';
import { DeckRelatedToken } from '../../types/Deck';
import { PlaytestProvider, usePlaytestContext } from '../playtest/PlaytestContext';
import { PlaytestControlBarTop } from '../playtest/PlaytestControlBarTop';
import { PlaytestControlBarBottom } from '../playtest/PlaytestControlBarBottom';
import { PlaytestLibraryGraveyard } from '../playtest/PlaytestLibraryGraveyard';
import { PlaytestBattlefield } from '../playtest/PlaytestBattlefield';
import { PlaytestHand } from '../playtest/PlaytestHand';
import { PlaytestLog } from '../playtest/PlaytestLog';
import { PlaytestModals } from '../playtest/PlaytestModals';
import { PlaytestFaceChoiceModal } from '../playtest/PlaytestFaceChoiceModal';
import { PlaytestShortcutsOverlay } from '../playtest/PlaytestShortcutsOverlay';
import { PlaytestParticles } from './PlaytestParticles';
import AmbientGlow from '../ui/AmbientGlow';
import { useRipple } from '../../hooks/useRipple';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useShortcutHandler } from '../../hooks/useShortcutHandler';

interface PlaytestSimulatorProps {
  isOpen: boolean;
  onClose: () => void;
  deckCards: Card[];
  deckFormat?: string;
  deckRelatedTokens?: DeckRelatedToken[];
}

function PlaytestSimulatorContent({
  onClose,
  deckCards,
  deckRelatedTokens
}: {
  onClose: () => void;
  deckCards: Card[];
  deckRelatedTokens: DeckRelatedToken[];
}) {
  const { t } = useTranslation();
  const createRipple = useRipple();
  const dialogRef = useFocusTrap<HTMLDivElement>(true);
  const {
    isMulliganPhase,
    mulligans,
    selectedToBottom,
    handleConfirmMulligan,
    handleKeepHand,
    handleDrawCard,
    handleShuffleLibrary,
    handleNextTurn,
    handleUndo,
    handleRedo,
    setIsShortcutsOpen,
    lifeTotal
  } = usePlaytestContext();

  const remainingToSelect = mulligans - selectedToBottom.size;

  // `blocksLowerLayers` is what used to be a `data-playtest-open` flag read by RootLayout:
  // this is a fullscreen mode, so app shortcuts must not fire on the UI hidden behind it —
  // including the keys the simulator itself ignores. Dialogs opened from here register on
  // the modal layer above and still get their key first.
  useShortcutHandler(
    (e) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return false;
      }

      const ctrl = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (ctrl && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
        return true;
      }
      if (ctrl && key === 'y') {
        e.preventDefault();
        handleRedo();
        return true;
      }
      if (ctrl) return false; // don't fire single-key shortcuts alongside modifiers

      if (e.key === '?') {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
        return true;
      }
      if (key === 'd') {
        e.preventDefault();
        handleDrawCard();
        return true;
      }
      if (key === 's') {
        e.preventDefault();
        handleShuffleLibrary();
        return true;
      }
      if (key === 't') {
        e.preventDefault();
        handleNextTurn();
        return true;
      }
      return false;
    },
    { layer: 'playtest', blocksLowerLayers: true }
  );

  return (
    <div className="modal-overlay p-2 sm:p-4 !z-[var(--z-playtest)]" style={{ zIndex: 'var(--z-playtest)' }}>
      {/* The simulator hosts its own dialogs (scry/surveil, tokens, shortcuts…), each with
          its own trap. Nesting works because the inner container's keydown handler runs
          first and stops the Tab there; this outer trap only catches focus that would
          otherwise fall through to the page behind. */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('playtest.playtestSimulator')}
        className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-2xl w-full h-full max-w-none shadow-2xl flex flex-col overflow-hidden transition-all duration-300"
      >
        <PlaytestControlBarTop onClose={onClose} />

        {isMulliganPhase ? (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
            <span className="text-xs text-amber-400 font-semibold flex items-center gap-1.5 justify-center sm:justify-start">
              <FaExclamationTriangle className="text-amber-500 shrink-0" />
              <span>
                {t('playtest.mulliganPhaseBanner', {
                  mulligans: String(mulligans),
                  count: remainingToSelect
                })}
              </span>
            </span>
            <div className="flex items-center gap-2 justify-center">
              {mulligans > 0 && remainingToSelect === 0 ? (
                <button
                  type="button"
                  onClick={(event) => {
                    createRipple(event);
                    handleConfirmMulligan();
                  }}
                  className="ripple-container bg-amber-500 hover:bg-warning text-slate-950 text-xs font-extrabold px-4 py-1.5 rounded-lg shadow-md transition-all flex items-center gap-1 cursor-pointer"
                >
                  <FaCheck />
                  {t('playtest.confirmMulligan')}
                </button>
              ) : null}
              <button
                type="button"
                onClick={(event) => {
                  createRipple(event);
                  handleKeepHand();
                }}
                className="ripple-container bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer"
              >
                {t('playtest.keepHand')}
              </button>
            </div>
          </div>
        ) : null}

        <div className="flex-1 flex flex-row overflow-hidden min-h-0 sm:min-h-[480px]">
          <div className="flex-1 p-3 sm:p-6 overflow-y-auto flex flex-col gap-4 sm:gap-6 relative bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] bg-slate-50 dark:bg-slate-950">
            <AmbientGlow lowLife={lifeTotal <= 5} intensity={1.4} positionClassName="absolute inset-0 z-0" />
            <PlaytestParticles />

            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-200/20 dark:to-slate-900/40 pointer-events-none" />

            <div className="relative flex flex-col lg:flex-row gap-4 sm:gap-6 items-stretch z-10">
              <PlaytestLibraryGraveyard />
              <PlaytestBattlefield />
            </div>

            <PlaytestHand />

            <PlaytestControlBarBottom deckCards={deckCards} />
          </div>

          <PlaytestLog />
        </div>
      </div>

      <PlaytestModals deckRelatedTokens={deckRelatedTokens} />
      <PlaytestFaceChoiceModal />
      <PlaytestShortcutsOverlay />
    </div>
  );
}

export default function PlaytestSimulator({
  isOpen,
  onClose,
  deckCards,
  deckFormat,
  deckRelatedTokens
}: PlaytestSimulatorProps) {
  if (!isOpen) return null;

  return createPortal(
    <PlaytestProvider deckCards={deckCards} deckFormat={deckFormat} isOpen={isOpen}>
      <PlaytestSimulatorContent onClose={onClose} deckCards={deckCards} deckRelatedTokens={deckRelatedTokens || []} />
    </PlaytestProvider>,
    document.body
  );
}
