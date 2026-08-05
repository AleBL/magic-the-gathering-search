import { useTranslation } from 'react-i18next';
import { FaHeart, FaRegHeart, FaPlus, FaMinus } from 'react-icons/fa';
import { Card } from '../../types/Card';
import { useCardCollection } from '../../hooks/useCardCollection';

interface CardCollectionControlsProps {
  card: Card;
  /**
   * `overlay` — compact cluster for the card grid (appears on hover, stays
   * visible while owned/wishlisted). `panel` — labelled row for the detail modal.
   */
  variant?: 'overlay' | 'panel';
}

export function CardCollectionControls({ card, variant = 'overlay' }: CardCollectionControlsProps) {
  const { t } = useTranslation();
  const { quantity, wishlist, increment, decrement, toggleWishlist } = useCardCollection(card);

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  if (variant === 'panel') {
    return (
      <div className="flex items-center justify-between gap-3 w-full mt-3 p-3 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-700">
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{t('collection.inCollection')}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleWishlist}
            aria-pressed={wishlist}
            title={t('collection.wishlist')}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
              wishlist
                ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300'
                : 'bg-white text-gray-400 hover:text-rose-500 dark:bg-slate-700 dark:text-slate-400 border border-gray-200 dark:border-slate-600'
            }`}
          >
            {wishlist ? <FaHeart className="text-sm" /> : <FaRegHeart className="text-sm" />}
          </button>
          <div className="flex items-center gap-2 rounded-full bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 px-1.5 py-1">
            <button
              type="button"
              onClick={decrement}
              disabled={quantity === 0}
              aria-label={t('collection.decrement')}
              className="w-8 h-8 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <FaMinus className="text-[10px]" />
            </button>
            <span className="min-w-[2ch] text-center text-sm font-bold text-gray-900 dark:text-white tabular-nums">
              {quantity}
            </span>
            <button
              type="button"
              onClick={increment}
              aria-label={t('collection.increment')}
              className="w-8 h-8 rounded-full flex items-center justify-center bg-primary text-white hover:bg-blue-500 transition-colors"
            >
              <FaPlus className="text-[10px]" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    // sm+: always visible — hidden-until-hover controls were the main reason
    // adding to the collection felt undiscoverable. Below sm the overlay is
    // hidden entirely: on phones the card grid is dense and mis-taps were
    // constant, so collection actions live in the card detail panel instead.
    // Bottom strip rather than top: the card's name sits along the top edge and these
    // controls sat right on it. The artist/copyright line down here is the one band that
    // carries nothing needed to recognise the card.
    <div className="absolute bottom-2 left-2 z-30 hidden sm:flex flex-col items-start gap-1.5">
      {quantity > 0 ? (
        <div className="flex items-center gap-1 bg-black/65 backdrop-blur-md rounded-full shadow-md border border-white/20 p-1 pointer-events-auto">
          <button
            type="button"
            onClick={(e) => {
              stop(e);
              decrement();
            }}
            title={t('collection.decrement')}
            aria-label={t('collection.decrement')}
            className="w-7 h-7 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors"
          >
            <FaMinus className="text-[9px]" />
          </button>
          <span className="min-w-[2ch] text-center text-xs font-extrabold text-white tabular-nums">{quantity}</span>
          <button
            type="button"
            onClick={(e) => {
              stop(e);
              increment();
            }}
            title={t('collection.increment')}
            aria-label={t('collection.increment')}
            className="w-7 h-7 sm:w-6 sm:h-6 rounded-full flex items-center justify-center bg-primary text-white hover:bg-blue-500 transition-colors"
          >
            <FaPlus className="text-[9px]" />
          </button>
        </div>
      ) : (
        // Labeled chip ("+ Collection") instead of a bare plus icon — the
        // action reads instantly on both desktop and mobile.
        <button
          type="button"
          onClick={(e) => {
            stop(e);
            increment();
          }}
          title={t('collection.markOwned')}
          aria-label={t('collection.markOwned')}
          className="flex items-center gap-1.5 h-8 sm:h-7 pl-2.5 pr-3 rounded-full bg-black/65 text-white text-[11px] sm:text-[10px] font-bold shadow-md backdrop-blur-md border border-white/20 hover:bg-primary transition-colors pointer-events-auto"
        >
          <FaPlus className="text-[9px] shrink-0" />
          {t('collection.tab')}
        </button>
      )}

      <button
        type="button"
        onClick={(e) => {
          stop(e);
          toggleWishlist();
        }}
        aria-pressed={wishlist}
        title={t('collection.wishlist')}
        aria-label={t('collection.wishlist')}
        className={`w-8 h-8 sm:w-7 sm:h-7 rounded-full flex items-center justify-center shadow-md backdrop-blur-md border transition-colors pointer-events-auto ${
          wishlist
            ? 'bg-rose-500/90 text-white border-rose-400'
            : 'bg-black/65 text-white/90 border-white/20 hover:bg-rose-500/80 hover:text-white'
        }`}
      >
        {wishlist ? <FaHeart className="text-xs" /> : <FaRegHeart className="text-xs" />}
      </button>
    </div>
  );
}
