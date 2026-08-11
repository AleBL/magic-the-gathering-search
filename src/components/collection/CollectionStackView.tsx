import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CollectionEntry } from '../../types/Collection';
import { Card } from '../../types/Card';

interface CollectionStackViewProps {
  entries: CollectionEntry[];
  onSelectCard: (card: Card) => void;
}

/** Primary type, in the order a collection binder is usually ordered. */
const TYPE_ORDER = ['Creature', 'Planeswalker', 'Instant', 'Sorcery', 'Artifact', 'Enchantment', 'Battle', 'Land'];

function primaryType(card: Card): string {
  const line = (card.type_line ?? '').toLowerCase();
  return TYPE_ORDER.find((type) => line.includes(type.toLowerCase())) ?? 'Other';
}

const artOf = (card: Card): string | undefined =>
  card.image_uris?.art_crop ?? card.card_faces?.[0]?.image_uris?.art_crop;

/**
 * The deck's stack view, applied to owned printings: one card per printing with shadow layers
 * behind it standing for the copies you hold, grouped by type. Same visual language as the
 * deck tab — the depth reads as "I have several of these" without opening anything.
 */
export function CollectionStackView({ entries, onSelectCard }: CollectionStackViewProps) {
  const { t } = useTranslation();

  const groups = useMemo(() => {
    const byType = new Map<string, CollectionEntry[]>();
    for (const entry of entries) {
      const key = primaryType(entry.card);
      const bucket = byType.get(key);
      if (bucket) bucket.push(entry);
      else byType.set(key, [entry]);
    }
    return TYPE_ORDER.concat('Other')
      .filter((type) => byType.has(type))
      .map((type) => ({ type, items: byType.get(type) as CollectionEntry[] }));
  }, [entries]);

  return (
    <div className="flex flex-col gap-5">
      {groups.map(({ type, items }) => (
        <section key={type}>
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
            {type} <span className="text-gray-400 dark:text-gray-500">({items.length})</span>
          </h3>
          <div className="deck-stack-cards-row">
            {items.map((entry) => {
              // Two shadow layers is the maximum the CSS draws; beyond that the badge carries it.
              const depth = Math.min(entry.quantity, 3);
              const art = artOf(entry.card);
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => onSelectCard(entry.card)}
                  data-stack-depth={depth}
                  className="deck-stack-card-wrapper group"
                  aria-label={`${entry.card.printed_name || entry.name} — ${t('collection.quantityShort')} ${entry.quantity}`}
                >
                  {depth >= 2 && (
                    <div className="deck-stack-shadow deck-stack-shadow-level-one bg-slate-300 dark:bg-slate-700" />
                  )}
                  {depth >= 3 && (
                    <div className="deck-stack-shadow deck-stack-shadow-level-two bg-slate-400 dark:bg-slate-600" />
                  )}

                  <div
                    className="deck-stack-main-card border-gray-300 dark:border-slate-700"
                    data-has-stack={depth >= 2}
                  >
                    {art ? (
                      <img
                        src={art}
                        alt=""
                        loading="lazy"
                        className="w-full h-full object-cover pointer-events-none select-none"
                      />
                    ) : (
                      <div className="p-2.5 text-left h-full flex flex-col justify-between bg-gray-100 dark:bg-slate-800">
                        <span className="text-[10px] font-extrabold leading-tight truncate-2-lines text-gray-900 dark:text-white">
                          {entry.card.printed_name || entry.name}
                        </span>
                        <span className="text-[9px] text-yellow-500 font-mono font-bold">{entry.card.mana_cost}</span>
                      </div>
                    )}
                  </div>

                  {entry.quantity > 1 ? <span className="deck-stack-count-badge">{entry.quantity}x</span> : null}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
