import { Card } from '../types/Card';
import { DeckFormat } from '../types/Deck';
import { DeckFormatType, DeckZone } from '../types/enums';
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

// Full resource paths. `getResource` returns `undefined` for a miss without warning, so a
// wrong path here silently turns every check below into "no card is a legal commander".
// A test asserts each one resolves.
export const CHECK_LIST_KEYS = {
  partner: 'validation.partnerCheckList',
  friends: 'validation.friendsCheckList',
  doctor: 'validation.doctorCheckList',
  backgroundCreature: 'validation.backgroundCreatureCheckList',
  background: 'validation.backgroundCheckList',
  legendary: 'validation.legendaryCheckList',
  canBeCommander: 'validation.canBeCommanderCheckList',
  creature: 'search.creature',
  planeswalker: 'search.planeswalker',
  basicLand: 'validation.basicLandCheckList',
  land: 'search.land'
} as const;

type CheckListKey = (typeof CHECK_LIST_KEYS)[keyof typeof CHECK_LIST_KEYS];

const MAX_COPIES_PER_CARD = 4;
const MAX_COMMANDERS = 2;

// All three shipped languages, not the active one: a card can arrive with its oracle text
// already translated, and matching one language would miss it.
const matchesPhraseList = (text: string, key: CheckListKey): boolean => {
  const lowerText = text.toLowerCase();
  const phrases = (['pt', 'en', 'es'] as const)
    .map((lng) => (i18n.getResource(lng, 'translations', key) as string) || '')
    .filter(Boolean)
    .flatMap((value) => value.toLowerCase().split(','));

  return phrases.some((phrase) => lowerText.includes(phrase.trim()));
};

// One place on purpose: three components used to read `card.legalities` themselves while
// Pauper's commons-only rule lived in `validateDeck` alone, so an uncommon invalidated the
// deck with no badge on the card that caused it. Anything that can invalidate a deck has to
// be visible on the card.
export type CardFormatStatus = 'legal' | 'banned' | 'restricted' | 'invalid';

export function cardFormatStatus(card: Card, format?: DeckFormat): CardFormatStatus {
  if (!format || format === DeckFormatType.FREEFORM) return 'legal';

  const legality = card.legalities?.[format as keyof typeof card.legalities];
  if (legality === 'banned') return 'banned';
  if (legality === 'restricted') return 'restricted';

  // Pauper allows commons only, whatever the ban list says.
  if (format === DeckFormatType.PAUPER && card.rarity && card.rarity !== 'common') return 'invalid';
  if (legality === 'not_legal') return 'invalid';

  return 'legal';
}

export function validateDeck(cards: Card[], format: DeckFormat): ValidationResult {
  const errors: ValidationError[] = [];

  // A card carries no zone until one is assigned, so an unset zone is the main deck.
  const zoneOf = (card: Card): DeckZone => card.zone ?? DeckZone.MAIN;

  // Size counts the main deck only, while copy limits, rarity and ban lists cover the
  // sideboard too. Maybeboard and tokens are not validated at all.
  const mainDeck = cards.filter((card) => zoneOf(card) === DeckZone.MAIN);
  const playableCards = cards.filter((card) => zoneOf(card) === DeckZone.MAIN || zoneOf(card) === DeckZone.SIDEBOARD);

  if (mainDeck.length === 0) {
    return {
      isValid: false,
      errors: [{ key: 'validationEmptyDeck' }]
    };
  }

  if (format === DeckFormatType.FREEFORM) {
    return { isValid: true, errors: [] };
  }

  const nonBasicCopiesByName: { [name: string]: number } = {};

  playableCards.forEach((card) => {
    const { name } = card;
    // "Basic" and "Land" are matched as two separate words because Scryfall puts the snow
    // supertype between them ("Basic Snow Land — Forest"), and through the phrase lists
    // because a pt/es type line never contains the English substring.
    const typeLine = card.type_line || '';
    const isBasic =
      (matchesPhraseList(typeLine, CHECK_LIST_KEYS.basicLand) && matchesPhraseList(typeLine, CHECK_LIST_KEYS.land)) ||
      BASIC_LAND_NAMES.includes(name);
    if (!isBasic) {
      nonBasicCopiesByName[name] = (nonBasicCopiesByName[name] || 0) + 1;
    }
  });

  const limitedCopyFormats: DeckFormat[] = [
    DeckFormatType.STANDARD,
    DeckFormatType.MODERN,
    DeckFormatType.VINTAGE,
    DeckFormatType.PAUPER
  ];
  if (limitedCopyFormats.includes(format)) {
    if (mainDeck.length < MIN_DECK_SIZE) {
      errors.push({
        key: 'validationMinCards',
        params: { count: mainDeck.length }
      });
    }

    Object.entries(nonBasicCopiesByName).forEach(([name, count]) => {
      if (count > MAX_COPIES_PER_CARD) {
        errors.push({
          key: 'validationMaxCopies',
          params: { name, count, max: MAX_COPIES_PER_CARD }
        });
      }
    });
  }

  if (format === DeckFormatType.COMMANDER) {
    if (mainDeck.length !== COMMANDER_DECK_SIZE) {
      errors.push({
        key: 'validationCommanderExactCards',
        params: { count: mainDeck.length }
      });
    }

    Object.entries(nonBasicCopiesByName).forEach(([name, count]) => {
      if (count > 1) {
        errors.push({
          key: 'validationCommanderSingleton',
          params: { name, count }
        });
      }
    });

    const commanders = mainDeck.filter((card) => card.isCommander);
    if (commanders.length === 0) {
      errors.push({
        key: 'validationCommanderNoCommander'
      });
    } else {
      if (commanders.length > MAX_COMMANDERS) {
        errors.push({
          key: 'validationCommanderMaxTwo'
        });
      } else if (commanders.length === MAX_COMMANDERS) {
        const [first, second] = commanders.map((commander) => ({
          typeLine: (commander.type_line || '').toLowerCase(),
          oracleText: (commander.oracle_text || '').toLowerCase()
        }));

        const hasPartner = (c: typeof first) => matchesPhraseList(c.oracleText, CHECK_LIST_KEYS.partner);
        const hasFriendsForever = (c: typeof first) => matchesPhraseList(c.oracleText, CHECK_LIST_KEYS.friends);
        const hasDoctorsCompanion = (c: typeof first) => matchesPhraseList(c.oracleText, CHECK_LIST_KEYS.doctor);
        const choosesBackground = (c: typeof first) =>
          matchesPhraseList(c.typeLine, CHECK_LIST_KEYS.creature) &&
          matchesPhraseList(c.oracleText, CHECK_LIST_KEYS.backgroundCreature);
        const isBackground = (c: typeof first) => matchesPhraseList(c.typeLine, CHECK_LIST_KEYS.background);

        const isValidPartnership =
          (hasPartner(first) && hasPartner(second)) ||
          (hasFriendsForever(first) && hasFriendsForever(second)) ||
          (hasDoctorsCompanion(first) && hasDoctorsCompanion(second)) ||
          (choosesBackground(first) && isBackground(second)) ||
          (choosesBackground(second) && isBackground(first));

        if (!isValidPartnership) {
          errors.push({
            key: 'validationCommanderInvalidPartnership'
          });
        }
      }

      commanders.forEach((commander) => {
        const typeLine = (commander.type_line || '').toLowerCase();
        const oracleText = (commander.oracle_text || '').toLowerCase();

        const isLegendary = matchesPhraseList(typeLine, CHECK_LIST_KEYS.legendary);
        const isCreature = matchesPhraseList(typeLine, CHECK_LIST_KEYS.creature);
        const isPlaneswalker = matchesPhraseList(typeLine, CHECK_LIST_KEYS.planeswalker);
        const canBeCommander = matchesPhraseList(oracleText, CHECK_LIST_KEYS.canBeCommander);

        const isValidCommander = (isLegendary && isCreature) || (isLegendary && isPlaneswalker && canBeCommander);

        if (!isValidCommander) {
          errors.push({
            key: 'validationCommanderInvalidCommander',
            params: { name: commander.name }
          });
        }
      });

      const commanderColors = new Set<string>();
      commanders.forEach((commander) => {
        if (commander.color_identity) {
          commander.color_identity.forEach((color) => commanderColors.add(color));
        }
      });

      const invalidCards: { name: string; colors: string[] }[] = [];
      playableCards.forEach((card) => {
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

        const cmdColorsString = Array.from(commanderColors).join('') || 'C';

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

  if (format === DeckFormatType.PAUPER) {
    const nonCommonCards = playableCards.filter((card) => card.rarity !== 'common');
    if (nonCommonCards.length > 0) {
      const uniqueNonCommons = Array.from(new Set(nonCommonCards.map((c) => c.name)));
      const list = uniqueNonCommons.slice(0, 5).join(', ') + (uniqueNonCommons.length > 5 ? '...' : '');
      errors.push({
        key: 'validationPauperCommonsOnly',
        params: { list }
      });
    }
  }

  // Ban and restriction status comes from Scryfall's `legalities`, never from a list kept here.
  const bannedMatches: string[] = [];
  const restrictedMatches: string[] = [];

  playableCards.forEach((card) => {
    const cardName = card.name;

    if (card.legalities) {
      const status = card.legalities[format as keyof typeof card.legalities];
      if (status === 'banned') {
        bannedMatches.push(cardName);
      }
    }

    // Restricted means one copy allowed, which only Vintage uses.
    if (format === DeckFormatType.VINTAGE && card.legalities?.vintage === 'restricted') {
      const count = nonBasicCopiesByName[cardName] || 0;
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
