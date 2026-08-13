import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaHeart, FaRegHeart } from 'react-icons/fa';
import { CollectionEntry } from '../../types/Collection';
import { Card } from '../../types/Card';
import { toggleWishlist } from '../../services/collectionService';

interface CollectionChecklistViewProps {
  entries: CollectionEntry[];
  onSelectCard: (card: Card) => void;
}

/**
 * The densest view: one thin row per card, for working through a box and ticking things off, or
 * checking a want list against what is already here.
 *
 * The checkbox toggles **wishlist**, not ownership. Ownership is a count, so a checkbox meaning
 * "one copy" would quietly destroy the number whenever it was unticked.
 */
export function CollectionChecklistView({ entries, onSelectCard }: CollectionChecklistViewProps) {
  const { t } = useTranslation();
  const [pending, setPending] = useState<string | null>(null);

  const sorted = useMemo(() => [...entries].sort((a, b) => a.name.localeCompare(b.name)), [entries]);

  const handleToggle = async (entry: CollectionEntry) => {
    setPending(entry.id);
    try {
      await toggleWishlist(entry.card);
    } finally {
      setPending(null);
    }
  };

  return (
    <ul className="rounded-xl border border-gray-200 dark:border-slate-700 divide-y divide-gray-100 dark:divide-slate-800 overflow-hidden">
      {sorted.map((entry) => (
        <li
          key={entry.id}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
        >
          {/* A bordered control rather than a bare glyph: as a faint outline it read as
              decoration and people did not realise the row could be ticked at all. */}
          <button
            type="button"
            onClick={() => handleToggle(entry)}
            disabled={pending === entry.id}
            aria-pressed={entry.wishlist}
            title={t('collection.wishlist')}
            aria-label={`${t('collection.wishlist')} — ${entry.card.printed_name || entry.name}`}
            className={`shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border transition-colors disabled:opacity-50 ${
              entry.wishlist
                ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-500 dark:text-rose-400'
                : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600 text-gray-400 dark:text-slate-500 hover:border-rose-300 hover:text-rose-400'
            }`}
          >
            {entry.wishlist ? <FaHeart className="text-sm" /> : <FaRegHeart className="text-sm" />}
          </button>

          <button
            type="button"
            onClick={() => onSelectCard(entry.card)}
            className="flex-1 min-w-0 text-left text-sm font-medium text-gray-800 dark:text-gray-100 truncate hover:text-primary dark:hover:text-blue-400"
          >
            {entry.card.printed_name || entry.name}
          </button>

          {/* Full set name where there is room; the code once the row gets tight. */}
          <span className="shrink-0 text-[11px] text-gray-400 dark:text-gray-500 hidden sm:inline max-w-[160px] truncate">
            <span className="hidden lg:inline">{entry.card.set_name || entry.set?.toUpperCase()}</span>
            <span className="lg:hidden uppercase">{entry.set}</span>
          </span>
          <span
            className={`shrink-0 w-8 text-right text-xs font-bold tabular-nums ${
              entry.quantity > 0 ? 'text-gray-800 dark:text-gray-100' : 'text-gray-300 dark:text-slate-600'
            }`}
          >
            {entry.quantity}
          </span>
        </li>
      ))}
    </ul>
  );
}
