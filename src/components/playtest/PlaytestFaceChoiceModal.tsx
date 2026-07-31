import { useTranslation } from 'react-i18next';
import { usePlaytestContext } from './PlaytestContext';
import { faceImage } from '../../utils/cardFaces';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useEscapeKey } from '../../hooks/useEscapeKey';

/**
 * Prompt shown when a double-faced card (transform/MDFC) is played from the
 * hand: the player must choose which face enters the battlefield. Each face is
 * a large clickable card showing its image, name and type line.
 */
export function PlaytestFaceChoiceModal() {
  const { t } = useTranslation();
  const { pendingFaceChoice, handleChooseFace, handleCancelFaceChoice } = usePlaytestContext();

  const isOpen = pendingFaceChoice !== null;
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen);
  useEscapeKey(handleCancelFaceChoice, isOpen);

  if (!pendingFaceChoice) return null;

  const faces = pendingFaceChoice.card.card_faces ?? [];
  if (faces.length < 2) return null;

  return (
    // Backdrop click is a pointer-only convenience; Escape and the cancel button cover keyboard users.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
    <div
      className="fixed inset-0 z-[var(--z-playtest-dialog)] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleCancelFaceChoice();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="face-choice-title"
        aria-describedby="face-choice-description"
        className="w-full sm:max-w-2xl max-h-[92dvh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-t-2xl sm:rounded-2xl shadow-2xl p-5 sm:p-6 animate-fadeIn"
      >
        <h3 id="face-choice-title" className="text-lg font-bold text-slate-900 dark:text-white">
          {t('playtest.chooseFaceTitle')}
        </h3>
        <p id="face-choice-description" className="text-sm text-slate-600 dark:text-slate-400 mt-1 mb-5">
          {t('playtest.chooseFaceDescription', {
            name: pendingFaceChoice.card.printed_name || pendingFaceChoice.card.name
          })}
        </p>

        <div className="grid grid-cols-2 gap-3 sm:gap-5">
          {faces.slice(0, 2).map((face, faceIndex) => {
            const imageUrl = faceImage(face);
            return (
              <button
                key={face.name}
                type="button"
                onClick={() => handleChooseFace(faceIndex)}
                className="group flex flex-col items-stretch gap-2 p-2.5 sm:p-3 rounded-2xl border-2 border-slate-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-400 focus-visible:border-indigo-500 bg-slate-50 dark:bg-slate-950/40 transition-all duration-200 active:scale-[0.98] cursor-pointer text-left"
              >
                <div className="aspect-[5/7] rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-800 shadow-md">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt=""
                      aria-hidden="true"
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center p-2 text-center text-xs font-bold text-slate-500">
                      {face.printed_name || face.name}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <span className="block text-sm font-bold text-slate-900 dark:text-white truncate">
                    {face.printed_name || face.name}
                  </span>
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {face.printed_type_line || face.type_line}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleCancelFaceChoice}
          className="mt-5 w-full min-h-11 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-sm font-bold text-slate-700 dark:text-slate-200 transition-colors duration-200 cursor-pointer"
        >
          {t('common.cancel')}
        </button>
      </div>
    </div>
  );
}
