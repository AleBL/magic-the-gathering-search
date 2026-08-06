import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FaTimes, FaPlus, FaPalette } from 'react-icons/fa';
import { getCardImageUrl } from '../../utils/deckGrouping';
import { Card } from '../../types/Card';
import { RelatedToken } from '../../hooks/useCardRelatedTokens';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface PlaytestTokenModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectToken: (tokenCard: Card) => void;
  deckRelatedTokens?: RelatedToken[];
}

export interface TokenPreset {
  id: string;
  name: string;
  type_line: string;
  colors: string[];
  power?: string;
  toughness?: string;
  oracle_text: string;
  rarity: string;
  set_name: string;
  localeKey: string;
  imageUrl?: string;
}

export const tokenPresets: TokenPreset[] = [
  {
    id: 'token-soldier',
    name: 'Soldier',
    type_line: 'Token Creature — Soldier',
    colors: ['W'],
    power: '1',
    toughness: '1',
    oracle_text: '',
    rarity: 'common',
    set_name: 'Tokens',
    localeKey: 'soldierToken',
    imageUrl: 'https://cards.scryfall.io/normal/front/d/e/dede70d6-ff7d-4171-bc01-f2f2cf53c5f4.jpg' // High-quality Soldier token
  },
  {
    id: 'token-zombie',
    name: 'Zombie',
    type_line: 'Token Creature — Zombie',
    colors: ['B'],
    power: '2',
    toughness: '2',
    oracle_text: '',
    rarity: 'common',
    set_name: 'Tokens',
    localeKey: 'zombieToken',
    imageUrl: 'https://cards.scryfall.io/normal/front/a/1/a1cd54b2-4d57-41ab-851c-6d9b936d5ad0.jpg' // Zombie token
  },
  {
    id: 'token-goblin',
    name: 'Goblin',
    type_line: 'Token Creature — Goblin',
    colors: ['R'],
    power: '1',
    toughness: '1',
    oracle_text: 'Haste',
    rarity: 'common',
    set_name: 'Tokens',
    localeKey: 'goblinToken',
    imageUrl: 'https://cards.scryfall.io/normal/front/1/7/17b2b73b-b27b-4bb8-86d1-d227c244bebf.jpg' // Goblin token
  },
  {
    id: 'token-thopter',
    name: 'Thopter',
    type_line: 'Token Artifact Creature — Thopter',
    colors: [],
    power: '1',
    toughness: '1',
    oracle_text: 'Flying',
    rarity: 'common',
    set_name: 'Tokens',
    localeKey: 'thopterToken',
    imageUrl: 'https://cards.scryfall.io/normal/front/7/8/7864f164-9b68-4b6c-918e-4a6c6e6e6e6e.jpg' // Thopter token
  },
  {
    id: 'token-saproling',
    name: 'Saproling',
    type_line: 'Token Creature — Saproling',
    colors: ['G'],
    power: '1',
    toughness: '1',
    oracle_text: '',
    rarity: 'common',
    set_name: 'Tokens',
    localeKey: 'saprolingToken',
    imageUrl: 'https://cards.scryfall.io/normal/front/d/a/da908b98-ea24-4f3b-ba2c-ed4a0e980ea2.jpg' // Saproling token
  },
  {
    id: 'token-bird',
    name: 'Bird',
    type_line: 'Token Creature — Bird',
    colors: ['U'],
    power: '1',
    toughness: '1',
    oracle_text: 'Flying',
    rarity: 'common',
    set_name: 'Tokens',
    localeKey: 'birdToken',
    imageUrl: 'https://cards.scryfall.io/normal/front/b/d/bd42c4db-9cb8-4f81-a9c4-dc1e35f8d386.jpg' // Bird token
  },
  {
    id: 'token-beast',
    name: 'Beast',
    type_line: 'Token Creature — Beast',
    colors: ['G'],
    power: '3',
    toughness: '3',
    oracle_text: '',
    rarity: 'common',
    set_name: 'Tokens',
    localeKey: 'beastToken',
    imageUrl: 'https://cards.scryfall.io/normal/front/b/d/bdc35353-8b77-4b7b-89da-0b89da1be79b.jpg' // Beast token
  },
  {
    id: 'token-treasure',
    name: 'Treasure',
    type_line: 'Token Artifact — Treasure',
    colors: [],
    oracle_text: '{T}, Sacrifice: Add one mana of any color.',
    rarity: 'common',
    set_name: 'Tokens',
    localeKey: 'treasureToken',
    imageUrl: 'https://cards.scryfall.io/normal/front/c/c/ccb10a30-e380-482d-88b9-ebcba6e8a7ea.jpg' // Treasure token
  },
  {
    id: 'token-food',
    name: 'Food',
    type_line: 'Token Artifact — Food',
    colors: [],
    oracle_text: '{2}, {T}, Sacrifice: You gain 3 life.',
    rarity: 'common',
    set_name: 'Tokens',
    localeKey: 'foodToken',
    imageUrl: 'https://cards.scryfall.io/normal/front/b/6/b66e0766-3d23-455b-80a5-fdb242fbcfb8.jpg' // Food token
  }
];

export function PlaytestTokenModal({
  isOpen,
  onClose,
  onSelectToken,
  deckRelatedTokens = []
}: PlaytestTokenModalProps) {
  const { t } = useTranslation();
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen);
  useEscapeKey(onClose, isOpen);

  const uniqueDeckTokens = useMemo(() => {
    const seen = new Set<string>();
    const result: RelatedToken[] = [];
    for (const token of deckRelatedTokens) {
      const powerVal = token.tokenCard.power || '';
      const toughnessVal = token.tokenCard.toughness || '';
      const colorVal = (token.tokenCard.colors || []).join(',');
      const oracleVal = token.tokenCard.oracle_text || '';
      const typeVal = token.tokenCard.type_line || '';
      const key = `${token.tokenCard.name}|${powerVal}|${toughnessVal}|${colorVal}|${oracleVal}|${typeVal}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(token);
      }
    }
    return result;
  }, [deckRelatedTokens]);

  if (!isOpen) return null;

  const getColorClass = (colors: string[]) => {
    if (colors.length === 0) return 'border-slate-700 bg-slate-800/40 text-slate-300';
    if (colors.includes('W')) return 'border-yellow-500/50 bg-yellow-500/5 text-yellow-300';
    if (colors.includes('U')) return 'border-blue-500/50 bg-blue-500/5 text-blue-300';
    if (colors.includes('B')) return 'border-purple-950 bg-purple-950/10 text-purple-400';
    if (colors.includes('R')) return 'border-red-500/50 bg-red-500/5 text-red-400';
    if (colors.includes('G')) return 'border-green-500/50 bg-green-500/5 text-green-400';
    return 'border-slate-700 bg-slate-800/40 text-slate-300';
  };

  return (
    // Backdrop click is a mouse-only convenience; Escape and the close button provide the keyboard-equivalent action.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="playtest-token-modal-title"
        className="modal-content"
      >
        {/* Header */}
        <div className="modal-header">
          <h3
            id="playtest-token-modal-title"
            className="text-base font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2"
          >
            <FaPlus className="text-indigo-500" />
            {t('tokens.tokenPool')}
          </h3>
          <button onClick={onClose} className="modal-close-btn" aria-label={t('common.close')}>
            <FaTimes />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body">
          {/* Deck Specific Tokens */}
          {uniqueDeckTokens.length > 0 ? (
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-850 pb-1.5 select-none">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)] animate-pulse" />
                <span>{t('tokens.deckRelatedTokens')}</span>
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {uniqueDeckTokens.map(({ tokenCard, generatorCardName }) => {
                  const imgUrl = getCardImageUrl(tokenCard);
                  const colorClass = getColorClass(tokenCard.colors || []);

                  return (
                    <div
                      key={tokenCard.id}
                      role="button"
                      tabIndex={0}
                      aria-label={tokenCard.printed_name || tokenCard.name}
                      className={`token-card-wrapper group ${colorClass}`}
                      onClick={() => onSelectToken(tokenCard)}
                      onKeyDown={(e) => {
                        if (e.target !== e.currentTarget) return;
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onSelectToken(tokenCard);
                        }
                      }}
                    >
                      <div className="w-20 h-28 rounded-lg overflow-hidden border border-slate-700 bg-slate-950 mb-3 shadow-md flex items-center justify-center relative shrink-0">
                        {imgUrl ? (
                          <img
                            src={imgUrl}
                            alt={tokenCard.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center gap-1.5 p-1 text-center w-full h-full bg-slate-900 border border-slate-800 rounded-lg">
                            <FaPalette className="text-indigo-500/40 text-xs shrink-0" />
                            <span className="text-[8px] text-slate-400 font-bold leading-tight break-words line-clamp-3 select-none">
                              {tokenCard.name}
                            </span>
                          </div>
                        )}
                        {tokenCard.power && tokenCard.toughness && (
                          <div className="absolute bottom-1 right-1 bg-slate-900/90 border border-slate-700/50 rounded px-1 text-[8px] font-bold text-slate-300 shadow">
                            {tokenCard.power}/{tokenCard.toughness}
                          </div>
                        )}
                      </div>

                      <div className="w-full min-w-0">
                        <h4 className="text-xs font-bold text-slate-200 truncate leading-tight group-hover:text-indigo-400 transition-colors">
                          {tokenCard.printed_name || tokenCard.name}
                        </h4>
                        <p className="text-[8px] text-slate-500 truncate mt-1">
                          {t('common.generatedBy')}:{' '}
                          <span className="font-extrabold text-indigo-400">{generatorCardName}</span>
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectToken(tokenCard);
                        }}
                        className="token-card-add-btn"
                      >
                        <FaPlus className="text-[8px]" />
                        {t('tokens.create')}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-2 text-center py-6">
              <span className="text-sm font-bold">{t('tokens.noTokensFound')}</span>
              <span className="text-xs text-slate-500">{t('playtest.playtestNoTokensTip')}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
