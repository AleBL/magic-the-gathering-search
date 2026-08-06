import { describe, expect, it, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import i18n from '../plugins/i18n';
import { getSymbolUrl, getSymbolLabel, parseTextWithSymbols } from './symbolHelper';

// Tests default to 'pt'; pin English so the alt-text assertions are readable.
beforeAll(async () => {
  await i18n.changeLanguage('en');
});

describe('getSymbolUrl', () => {
  it('builds a Scryfall svg url for an unknown symbol, stripping braces', () => {
    expect(getSymbolUrl('{G}')).toBe('https://svgs.scryfall.io/card-symbols/G.svg');
  });

  it('strips slashes from hybrid symbols', () => {
    expect(getSymbolUrl('{G/W}')).toBe('https://svgs.scryfall.io/card-symbols/GW.svg');
  });
});

describe('getSymbolLabel', () => {
  it('describes mono-color mana', () => {
    expect(getSymbolLabel('{G}')).toBe('Green mana');
    expect(getSymbolLabel('{U}')).toBe('Blue mana');
  });

  it('describes generic and special symbols', () => {
    expect(getSymbolLabel('{2}')).toBe('2 generic mana');
    expect(getSymbolLabel('{T}')).toBe('Tap');
    expect(getSymbolLabel('{X}')).toBe('Variable mana');
    expect(getSymbolLabel('{G/W}')).toBe('Hybrid mana');
    expect(getSymbolLabel('{W/P}')).toBe('Phyrexian mana');
  });

  it('falls back to the cleaned symbol when unknown', () => {
    expect(getSymbolLabel('{½}')).toBe('½');
  });
});

describe('parseTextWithSymbols', () => {
  it('renders mana symbols as images with descriptive alt text and keeps surrounding text', () => {
    render(<div>{parseTextWithSymbols('{T}: Add {G}.')}</div>);

    expect(screen.getByAltText('Tap')).toBeInTheDocument();
    expect(screen.getByAltText('Green mana')).toBeInTheDocument();
    expect(screen.getByText(/Add/)).toBeInTheDocument();
  });

  it('returns nothing for empty or undefined text', () => {
    expect(parseTextWithSymbols(undefined)).toEqual([]);
    expect(parseTextWithSymbols('')).toEqual([]);
  });
});
