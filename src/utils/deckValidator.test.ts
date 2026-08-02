import { describe, expect, it } from 'vitest';
import { CHECK_LIST_KEYS, validateDeck } from './deckValidator';
import { DeckFormatType, DeckZone } from '../types/enums';
import { makeCard } from '../test/factories';
import { Card } from '../types/Card';
import i18n from '../plugins/i18n';

const copies = (n: number, overrides: Partial<Card> = {}): Card[] =>
  Array.from({ length: n }, () => makeCard(overrides));

// Distinct-named cards, so the only rule under test is the one being asserted
// (not an accidental 4-copy violation from repeated filler names).
const uniqueCards = (n: number, overrides: Partial<Card> = {}): Card[] =>
  Array.from({ length: n }, (_, i) => makeCard({ ...overrides, name: `Unique ${i}` }));

const errorKeys = (cards: Card[], format: Parameters<typeof validateDeck>[1]) =>
  validateDeck(cards, format).errors.map((e) => e.key);

// Regression guard. These paths were wrong from the commit that introduced them
// ('partnerCheckList' instead of 'validation.partnerCheckList'), and because
// getResource returns undefined for a miss, every Commander eligibility and
// partnership check silently evaluated to false. Nothing else fails when they
// break, so assert the lookups resolve.
describe('commander rule phrase lists', () => {
  const languages = ['en', 'pt', 'es'] as const;

  it.each(Object.entries(CHECK_LIST_KEYS))('resolves %s in every language', (_name, key) => {
    for (const lng of languages) {
      const value = i18n.getResource(lng, 'translations', key);
      expect(typeof value === 'string' && value.length > 0, `${key} missing for "${lng}"`).toBe(true);
    }
  });
});

describe('validateDeck', () => {
  it('flags an empty deck as invalid', () => {
    const result = validateDeck([], DeckFormatType.STANDARD);
    expect(result.isValid).toBe(false);
    expect(result.errors.map((e) => e.key)).toEqual(['validationEmptyDeck']);
  });

  it('treats any non-empty freeform deck as valid', () => {
    const result = validateDeck(copies(3), DeckFormatType.FREEFORM);
    expect(result).toEqual({ isValid: true, errors: [] });
  });

  it('requires the minimum deck size for constructed formats', () => {
    const keys = errorKeys(copies(10, { name: 'Distinct', rarity: 'common' }), DeckFormatType.STANDARD);
    expect(keys).toContain('validationMinCards');
  });

  it('rejects more than four copies of a non-basic card in Standard', () => {
    const deck = [...copies(5, { name: 'Lightning Bolt' }), ...copies(55, { name: 'Filler' })];
    const errors = validateDeck(deck, DeckFormatType.STANDARD).errors;
    const maxCopies = errors.find((e) => e.key === 'validationMaxCopies');
    expect(maxCopies?.params).toMatchObject({ name: 'Lightning Bolt', count: 5, max: 4 });
  });

  it('exempts basic lands from the four-copy limit', () => {
    const deck = [
      ...copies(20, { name: 'Mountain', type_line: 'Basic Land — Mountain' }),
      ...uniqueCards(40, { rarity: 'common' })
    ];
    const keys = errorKeys(deck, DeckFormatType.STANDARD);
    expect(keys).not.toContain('validationMaxCopies');
  });

  it('requires exactly 100 cards for Commander', () => {
    const commander = makeCard({ name: 'Cmd', isCommander: true });
    const keys = errorKeys([commander, ...copies(50, { name: 'X' })], DeckFormatType.COMMANDER);
    expect(keys).toContain('validationCommanderExactCards');
  });

  it('enforces the Commander singleton rule for non-basic cards', () => {
    const commander = makeCard({ name: 'Cmd', isCommander: true });
    const distinctDeck = [commander, ...copies(2, { name: 'Sol Ring' })];
    const singleton = validateDeck(distinctDeck, DeckFormatType.COMMANDER).errors.find(
      (e) => e.key === 'validationCommanderSingleton'
    );
    expect(singleton?.params).toMatchObject({ name: 'Sol Ring', count: 2 });
  });

  it('reports a missing Commander', () => {
    const keys = errorKeys(copies(100, { name: 'Filler' }), DeckFormatType.COMMANDER);
    expect(keys).toContain('validationCommanderNoCommander');
  });

  it('flags non-common cards in Pauper', () => {
    const deck = [makeCard({ name: 'Fancy', rarity: 'rare' }), ...copies(59, { name: 'Cheap', rarity: 'common' })];
    const pauper = validateDeck(deck, DeckFormatType.PAUPER).errors.find(
      (e) => e.key === 'validationPauperCommonsOnly'
    );
    expect(pauper?.params).toMatchObject({ list: 'Fancy' });
  });

  it('flags cards banned in the selected format via Scryfall legalities', () => {
    const banned = makeCard({
      name: 'Banned Card',
      rarity: 'common',
      legalities: {
        standard: 'banned',
        modern: 'legal',
        legacy: 'legal',
        commander: 'legal',
        pauper: 'legal',
        vintage: 'legal',
        pioneer: 'legal'
      }
    });
    const deck = [banned, ...copies(59, { name: 'Filler', rarity: 'common' })];
    const banlist = validateDeck(deck, DeckFormatType.STANDARD).errors.find((e) => e.key === 'validationBanlist');
    expect(banlist?.params).toMatchObject({ format: 'standard', list: 'Banned Card' });
  });
});

// The partnership and colour-identity rules read their trigger phrases out of the
// i18n resources, so these fixtures spell the oracle text the way a real card does.
const legendaryCreature = (name: string, overrides: Partial<Card> = {}): Card =>
  makeCard({ name, type_line: 'Legendary Creature — Human', isCommander: true, ...overrides });

describe('validateDeck — Commander partnerships', () => {
  it('accepts two commanders that both have Partner', () => {
    const deck = [
      legendaryCreature('Partner A', { oracle_text: 'Partner (You can have two commanders if both have partner.)' }),
      legendaryCreature('Partner B', { oracle_text: 'Partner (You can have two commanders if both have partner.)' })
    ];
    expect(errorKeys(deck, DeckFormatType.COMMANDER)).not.toContain('validationCommanderInvalidPartnership');
  });

  it('accepts two commanders that both have Friends forever', () => {
    const deck = [
      legendaryCreature('Friend A', { oracle_text: 'Friends forever' }),
      legendaryCreature('Friend B', { oracle_text: 'Friends forever' })
    ];
    expect(errorKeys(deck, DeckFormatType.COMMANDER)).not.toContain('validationCommanderInvalidPartnership');
  });

  it("accepts two commanders that both have Doctor's companion", () => {
    const deck = [
      legendaryCreature('Companion A', { oracle_text: "Doctor's companion" }),
      legendaryCreature('The Doctor', { oracle_text: "Doctor's companion" })
    ];
    expect(errorKeys(deck, DeckFormatType.COMMANDER)).not.toContain('validationCommanderInvalidPartnership');
  });

  it('accepts a Choose a Background commander paired with a Background', () => {
    const deck = [
      legendaryCreature('Background Chooser', { oracle_text: 'Choose a Background' }),
      makeCard({
        name: 'Cultist of the Absolute',
        type_line: 'Legendary Enchantment — Background',
        isCommander: true
      })
    ];
    expect(errorKeys(deck, DeckFormatType.COMMANDER)).not.toContain('validationCommanderInvalidPartnership');
  });

  it('rejects two commanders with no partnership ability between them', () => {
    const deck = [legendaryCreature('Solo A'), legendaryCreature('Solo B')];
    expect(errorKeys(deck, DeckFormatType.COMMANDER)).toContain('validationCommanderInvalidPartnership');
  });

  it('rejects more than two commanders', () => {
    const deck = [legendaryCreature('A'), legendaryCreature('B'), legendaryCreature('C')];
    expect(errorKeys(deck, DeckFormatType.COMMANDER)).toContain('validationCommanderMaxTwo');
  });
});

describe('validateDeck — Commander eligibility', () => {
  it('rejects a commander that is not legendary', () => {
    const deck = [makeCard({ name: 'Grizzly Bears', type_line: 'Creature — Bear', isCommander: true })];
    const invalid = validateDeck(deck, DeckFormatType.COMMANDER).errors.find(
      (e) => e.key === 'validationCommanderInvalidCommander'
    );
    expect(invalid?.params).toMatchObject({ name: 'Grizzly Bears' });
  });

  it('accepts a planeswalker that says it can be your commander', () => {
    const deck = [
      makeCard({
        name: 'Freyalise, Llanowar S Fury',
        type_line: 'Legendary Planeswalker — Freyalise',
        oracle_text: 'Freyalise can be your commander.',
        isCommander: true
      })
    ];
    expect(errorKeys(deck, DeckFormatType.COMMANDER)).not.toContain('validationCommanderInvalidCommander');
  });

  it('rejects a planeswalker without the can-be-your-commander clause', () => {
    const deck = [
      makeCard({
        name: 'Jace, the Mind Sculptor',
        type_line: 'Legendary Planeswalker — Jace',
        oracle_text: 'Brainstorm.',
        isCommander: true
      })
    ];
    expect(errorKeys(deck, DeckFormatType.COMMANDER)).toContain('validationCommanderInvalidCommander');
  });
});

describe('validateDeck — Commander colour identity', () => {
  it('flags cards outside the commander colour identity', () => {
    const deck = [
      legendaryCreature('Mono White Cmd', { color_identity: ['W'] }),
      makeCard({ name: 'Counterspell', color_identity: ['U'] })
    ];
    const identity = validateDeck(deck, DeckFormatType.COMMANDER).errors.find(
      (e) => e.key === 'validationCommanderColorIdentity'
    );
    expect(identity?.params).toMatchObject({ list: 'Counterspell (U)', cmdColors: 'W' });
  });

  it('combines the identity of both commanders before judging the rest of the deck', () => {
    const deck = [
      legendaryCreature('WU A', { color_identity: ['W'], oracle_text: 'Partner' }),
      legendaryCreature('WU B', { color_identity: ['U'], oracle_text: 'Partner' }),
      makeCard({ name: 'Azorius Charm', color_identity: ['W', 'U'] })
    ];
    expect(errorKeys(deck, DeckFormatType.COMMANDER)).not.toContain('validationCommanderColorIdentity');
  });

  it('reports a colourless commander identity as C', () => {
    const deck = [
      legendaryCreature('Karn', { color_identity: [] }),
      makeCard({ name: 'Counterspell', color_identity: ['U'] })
    ];
    const identity = validateDeck(deck, DeckFormatType.COMMANDER).errors.find(
      (e) => e.key === 'validationCommanderColorIdentity'
    );
    expect(identity?.params).toMatchObject({ cmdColors: 'C' });
  });

  it('truncates the offending list after three cards', () => {
    const deck = [
      legendaryCreature('Mono White Cmd', { color_identity: ['W'] }),
      ...['A', 'B', 'C', 'D'].map((name) => makeCard({ name, color_identity: ['U'] }))
    ];
    const identity = validateDeck(deck, DeckFormatType.COMMANDER).errors.find(
      (e) => e.key === 'validationCommanderColorIdentity'
    );
    expect(identity?.params?.list).toBe('A (U), B (U), C (U)...');
  });
});

describe('validateDeck — Vintage restricted list', () => {
  const restricted = (name: string) =>
    makeCard({
      name,
      legalities: {
        standard: 'not_legal',
        modern: 'not_legal',
        legacy: 'banned',
        commander: 'legal',
        pauper: 'not_legal',
        vintage: 'restricted',
        pioneer: 'not_legal'
      }
    });

  it('allows a single copy of a restricted card', () => {
    const deck = [restricted('Black Lotus'), ...uniqueCards(59)];
    expect(errorKeys(deck, DeckFormatType.VINTAGE)).not.toContain('validationRestrictedList');
  });

  it('flags a second copy of a restricted card', () => {
    const deck = [restricted('Black Lotus'), restricted('Black Lotus'), ...uniqueCards(58)];
    const result = validateDeck(deck, DeckFormatType.VINTAGE).errors.find((e) => e.key === 'validationRestrictedList');
    expect(result?.params).toMatchObject({ list: 'Black Lotus' });
  });

  it('ignores the restricted status outside Vintage', () => {
    const deck = [restricted('Black Lotus'), restricted('Black Lotus'), ...uniqueCards(58)];
    expect(errorKeys(deck, DeckFormatType.MODERN)).not.toContain('validationRestrictedList');
  });
});

// Zones existed in the model and in the UI, but validation ignored them entirely: every
// card in the deck object was counted, whichever pile it sat in. A maybeboard is a
// scratchpad — counting it toward the 60-card minimum, or toward the 4-copy limit, makes
// the validator answer a question nobody asked.
describe('validateDeck — deck zones', () => {
  const inZone = (zone: DeckZone, n: number, overrides: Partial<Card> = {}): Card[] =>
    Array.from({ length: n }, (_, i) => makeCard({ ...overrides, name: `${zone} ${i}`, zone }));

  it('does not count maybeboard cards toward the minimum deck size', () => {
    const deck = [...uniqueCards(59, { rarity: 'common' }), ...inZone(DeckZone.MAYBEBOARD, 10)];
    expect(errorKeys(deck, DeckFormatType.STANDARD)).toContain('validationMinCards');
  });

  it('does not count sideboard cards toward the minimum deck size', () => {
    const deck = [...uniqueCards(59, { rarity: 'common' }), ...inZone(DeckZone.SIDEBOARD, 15)];
    expect(errorKeys(deck, DeckFormatType.STANDARD)).toContain('validationMinCards');
  });

  it('ignores maybeboard copies when applying the four-copy limit', () => {
    const deck = [
      ...copies(4, { name: 'Lightning Bolt' }),
      ...copies(3, { name: 'Lightning Bolt', zone: DeckZone.MAYBEBOARD }),
      ...uniqueCards(56, { rarity: 'common' })
    ];
    expect(errorKeys(deck, DeckFormatType.STANDARD)).not.toContain('validationMaxCopies');
  });

  // The sideboard is part of the deck for copy limits: 3 main + 2 side is 5 copies.
  it('counts sideboard copies toward the four-copy limit', () => {
    const deck = [
      ...copies(3, { name: 'Lightning Bolt' }),
      ...copies(2, { name: 'Lightning Bolt', zone: DeckZone.SIDEBOARD }),
      ...uniqueCards(57, { rarity: 'common' })
    ];
    const violation = validateDeck(deck, DeckFormatType.STANDARD).errors.find((e) => e.key === 'validationMaxCopies');
    expect(violation?.params).toMatchObject({ name: 'Lightning Bolt', count: 5 });
  });

  it("counts only the main deck toward Commander's exact 100", () => {
    const commander = makeCard({ name: 'Cmd', type_line: 'Legendary Creature — Human', isCommander: true });
    const deck = [commander, ...uniqueCards(99), ...inZone(DeckZone.MAYBEBOARD, 5)];
    expect(errorKeys(deck, DeckFormatType.COMMANDER)).not.toContain('validationCommanderExactCards');
  });

  it('still flags a non-common sitting in the Pauper sideboard', () => {
    const deck = [
      ...uniqueCards(60, { rarity: 'common' }),
      makeCard({ name: 'Fancy', rarity: 'rare', zone: DeckZone.SIDEBOARD })
    ];
    expect(errorKeys(deck, DeckFormatType.PAUPER)).toContain('validationPauperCommonsOnly');
  });

  it('reports a deck that exists only in the maybeboard as empty', () => {
    expect(errorKeys(inZone(DeckZone.MAYBEBOARD, 60), DeckFormatType.STANDARD)).toEqual(['validationEmptyDeck']);
  });
});
