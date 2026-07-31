import { Card } from '../types/Card';
import { DeckFormat } from '../types/Deck';
import { DeckFormatType } from '../types/enums';
import i18n from '../plugins/i18n';
import { BASIC_LAND_NAMES, MIN_DECK_SIZE, COMMANDER_DECK_SIZE } from '../constants';

export interface ValidationError {
  key: string;
  params?: Record<string, unknown>;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

/**
 * Full resource paths of the phrase lists the Commander rules match card text against.
 * `getResource` walks the namespace by path and returns `undefined` for a miss — it does
 * not warn and does not fall back — so a wrong path here silently turns every check below
 * into `false`, which reads as "no card is a legal commander". They are named once here
 * and asserted to resolve in `deckValidator.test.ts`, so a locale reshuffle fails loudly.
 */
export const CHECK_LIST_KEYS = {
  partner: 'validation.partnerCheckList',
  friends: 'validation.friendsCheckList',
  doctor: 'validation.doctorCheckList',
  backgroundCreature: 'validation.backgroundCreatureCheckList',
  background: 'validation.backgroundCheckList',
  legendary: 'validation.legendaryCheckList',
  canBeCommander: 'validation.canBeCommanderCheckList',
  creature: 'search.creature',
  planeswalker: 'search.planeswalker'
} as const;

type CheckListKey = (typeof CHECK_LIST_KEYS)[keyof typeof CHECK_LIST_KEYS];

/**
 * True when `text` contains any phrase from the given list, in any of the three shipped
 * languages. Cards can be displayed translated, so matching only the active language would
 * miss a card whose oracle text arrived in another one.
 */
const matchesPhraseList = (text: string, key: CheckListKey): boolean => {
  const lowerText = text.toLowerCase();
  const phrases = (['pt', 'en', 'es'] as const)
    .map((lng) => (i18n.getResource(lng, 'translations', key) as string) || '')
    .filter(Boolean)
    .flatMap((value) => value.toLowerCase().split(','));

  return phrases.some((phrase) => lowerText.includes(phrase.trim()));
};

export function validateDeck(cards: Card[], format: DeckFormat): ValidationResult {
  const errors: ValidationError[] = [];

  if (cards.length === 0) {
    return {
      isValid: false,
      errors: [{ key: 'validationEmptyDeck' }]
    };
  }

  if (format === DeckFormatType.FREEFORM) {
    return { isValid: true, errors: [] };
  }

  // Count copies of each card (excluding basic lands)
  const cardCounts: { [name: string]: number } = {};

  cards.forEach((card) => {
    const { name } = card;
    const isBasic = card.type_line?.toLowerCase().includes('basic land') || BASIC_LAND_NAMES.includes(name);
    if (!isBasic) {
      cardCounts[name] = (cardCounts[name] || 0) + 1;
    }
  });

  // Rules: Max 4 copies of any non-basic land card for Standard, Modern, Vintage, Pauper
  const limitedCopyFormats: DeckFormat[] = [
    DeckFormatType.STANDARD,
    DeckFormatType.MODERN,
    DeckFormatType.VINTAGE,
    DeckFormatType.PAUPER
  ];
  if (limitedCopyFormats.includes(format)) {
    if (cards.length < MIN_DECK_SIZE) {
      errors.push({
        key: 'validationMinCards',
        params: { count: cards.length }
      });
    }

    Object.entries(cardCounts).forEach(([name, count]) => {
      if (count > 4) {
        errors.push({
          key: 'validationMaxCopies',
          params: { name, count, max: 4 }
        });
      }
    });
  }

  // Commander Format Rules
  if (format === DeckFormatType.COMMANDER) {
    if (cards.length !== COMMANDER_DECK_SIZE) {
      errors.push({
        key: 'validationCommanderExactCards',
        params: { count: cards.length }
      });
    }

    // Singleton rule: Max 1 copy of any non-basic land card
    Object.entries(cardCounts).forEach(([name, count]) => {
      if (count > 1) {
        errors.push({
          key: 'validationCommanderSingleton',
          params: { name, count }
        });
      }
    });

    // 1. Check if there is at least one designated Commander in the deck
    const commanders = cards.filter((card) => card.isCommander);
    if (commanders.length === 0) {
      errors.push({
        key: 'validationCommanderNoCommander'
      });
    } else {
      if (commanders.length > 2) {
        errors.push({
          key: 'validationCommanderMaxTwo'
        });
      } else if (commanders.length === 2) {
        // Validate Partner / Choose a Background rule
        const [c1, c2] = commanders;
        const t1 = (c1.type_line || '').toLowerCase();
        const t2 = (c2.type_line || '').toLowerCase();
        const o1 = (c1.oracle_text || '').toLowerCase();
        const o2 = (c2.oracle_text || '').toLowerCase();

        // Check Partner, Friends Forever, Doctor's Companion, and Choose a Background rules using i18n
        const isPartner1 = matchesPhraseList(o1, CHECK_LIST_KEYS.partner);
        const isPartner2 = matchesPhraseList(o2, CHECK_LIST_KEYS.partner);

        const isFriends1 = matchesPhraseList(o1, CHECK_LIST_KEYS.friends);
        const isFriends2 = matchesPhraseList(o2, CHECK_LIST_KEYS.friends);

        const isDoctor1 = matchesPhraseList(o1, CHECK_LIST_KEYS.doctor);
        const isDoctor2 = matchesPhraseList(o2, CHECK_LIST_KEYS.doctor);

        // Check Choose a Background + Background
        const isBackgroundCreature1 =
          matchesPhraseList(t1, CHECK_LIST_KEYS.creature) && matchesPhraseList(o1, CHECK_LIST_KEYS.backgroundCreature);
        const isBackground1 = matchesPhraseList(t1, CHECK_LIST_KEYS.background);
        const isBackgroundCreature2 =
          matchesPhraseList(t2, CHECK_LIST_KEYS.creature) && matchesPhraseList(o2, CHECK_LIST_KEYS.backgroundCreature);
        const isBackground2 = matchesPhraseList(t2, CHECK_LIST_KEYS.background);

        const isValidPartnership =
          (isPartner1 && isPartner2) ||
          (isFriends1 && isFriends2) ||
          (isDoctor1 && isDoctor2) ||
          (isBackgroundCreature1 && isBackground2) ||
          (isBackgroundCreature2 && isBackground1);

        if (!isValidPartnership) {
          errors.push({
            key: 'validationCommanderInvalidPartnership'
          });
        }
      }
      // 2. Validate designated commander(s)
      commanders.forEach((commander) => {
        const typeLine = (commander.type_line || '').toLowerCase();
        const oracleText = (commander.oracle_text || '').toLowerCase();

        const isLegendary = matchesPhraseList(typeLine, CHECK_LIST_KEYS.legendary);
        const isCreature = matchesPhraseList(typeLine, CHECK_LIST_KEYS.creature);
        const isPlaneswalker = matchesPhraseList(typeLine, CHECK_LIST_KEYS.planeswalker);
        const canBeCommander = matchesPhraseList(oracleText, CHECK_LIST_KEYS.canBeCommander);

        const isValidCmd = (isLegendary && isCreature) || (isLegendary && isPlaneswalker && canBeCommander);

        if (!isValidCmd) {
          errors.push({
            key: 'validationCommanderInvalidCommander',
            params: { name: commander.name }
          });
        }
      });

      // 3. Validate color identity of all other cards against the combined identity of commanders
      const commanderColors = new Set<string>();
      commanders.forEach((commander) => {
        if (commander.color_identity) {
          commander.color_identity.forEach((color) => commanderColors.add(color));
        }
      });

      const invalidCards: { name: string; colors: string[] }[] = [];
      cards.forEach((card) => {
        if (card.isCommander) return;

        if (card.color_identity) {
          const hasInvalidColor = card.color_identity.some((color) => !commanderColors.has(color));
          if (hasInvalidColor) {
            invalidCards.push({ name: card.name, colors: card.color_identity });
          }
        }
      });

      if (invalidCards.length > 0) {
        const invalidList =
          invalidCards
            .slice(0, 3)
            .map((card) => `${card.name} (${card.colors.join('')})`)
            .join(', ') + (invalidCards.length > 3 ? '...' : '');

        const cmdColorsString = Array.from(commanderColors).join('') || 'C'; // Colorless

        errors.push({
          key: 'validationCommanderColorIdentity',
          params: {
            list: invalidList,
            cmdColors: cmdColorsString
          }
        });
      }
    }
  }

  // Pauper Format Rules
  if (format === DeckFormatType.PAUPER) {
    const nonCommonCards = cards.filter((card) => card.rarity !== 'common');
    if (nonCommonCards.length > 0) {
      const uniqueNonCommons = Array.from(new Set(nonCommonCards.map((c) => c.name)));
      const list = uniqueNonCommons.slice(0, 5).join(', ') + (uniqueNonCommons.length > 5 ? '...' : '');
      errors.push({
        key: 'validationPauperCommonsOnly',
        params: { list }
      });
    }
  }

  // Format Banned & Restricted lists validation from Scryfall API legalities
  const bannedMatches: string[] = [];
  const restrictedMatches: string[] = [];

  cards.forEach((card) => {
    const cardName = card.name;

    // Check if card is banned in the selected format
    if (card.legalities) {
      const status = card.legalities[format as keyof typeof card.legalities];
      if (status === 'banned') {
        bannedMatches.push(cardName);
      }
    }

    // Check Vintage Restricted (limit 1)
    if (format === DeckFormatType.VINTAGE && card.legalities?.vintage === 'restricted') {
      const count = cardCounts[cardName] || 0;
      if (count > 1) {
        restrictedMatches.push(cardName);
      }
    }
  });

  if (bannedMatches.length > 0) {
    const uniqueBanned = Array.from(new Set(bannedMatches));
    const list = uniqueBanned.slice(0, 5).join(', ') + (uniqueBanned.length > 5 ? '...' : '');
    errors.push({
      key: 'validationBanlist',
      params: { format, list }
    });
  }

  if (restrictedMatches.length > 0) {
    const uniqueRestricted = Array.from(new Set(restrictedMatches));
    const list = uniqueRestricted.slice(0, 5).join(', ') + (uniqueRestricted.length > 5 ? '...' : '');
    errors.push({
      key: 'validationRestrictedList',
      params: { list }
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
