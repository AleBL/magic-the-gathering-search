import { logger } from './logger';
import { ReactNode } from 'react';
import i18n from '../plugins/i18n';
import { dispatchToast } from './toastHelper';
let symbolMap: Record<string, string> = {};
let isFetching = false;

interface ScryfallSymbol {
  symbol?: string;
  svg_uri?: string;
}

export async function fetchSymbols() {
  if (Object.keys(symbolMap).length > 0 || isFetching) return;
  isFetching = true;
  try {
    const res = await fetch('https://api.scryfall.com/symbology');
    const json = await res.json();
    if (json.data && Array.isArray(json.data)) {
      const map: Record<string, string> = {};
      json.data.forEach((sym: ScryfallSymbol) => {
        if (sym.symbol && sym.svg_uri) {
          map[sym.symbol] = sym.svg_uri;
        }
      });
      symbolMap = map;
    }
  } catch (error) {
    logger.error('Failed to fetch Scryfall symbology:', error);
    dispatchToast(i18n.t('common.errorFetchingSymbology') as string, 'danger');
  } finally {
    isFetching = false;
  }
}

export function getSymbolUrl(symbol: string): string {
  if (symbolMap[symbol]) {
    return symbolMap[symbol];
  }
  const clean = symbol.replace(/[{}]/g, '').replace(/\//g, '');
  return `https://svgs.scryfall.io/card-symbols/${clean}.svg`;
}

/**
 * Human-readable, localized label for a mana/tap symbol, used as image `alt`
 * text so screen readers announce "Green mana" instead of the raw "{G}".
 */
export function getSymbolLabel(symbol: string): string {
  const clean = symbol.replace(/[{}]/g, '');
  const t = (key: string, opts?: Record<string, unknown>): string => i18n.t(key, opts) as string;

  const colors: Record<string, string> = {
    W: 'mana.white',
    U: 'mana.blue',
    B: 'mana.black',
    R: 'mana.red',
    G: 'mana.green',
    C: 'mana.colorless'
  };

  if (colors[clean]) return t(colors[clean]);
  if (/^\d+$/.test(clean)) return t('mana.generic', { amount: clean });
  if (clean === 'X' || clean === 'Y' || clean === 'Z') return t('mana.variable');
  if (clean === 'T') return t('mana.tap');
  if (clean === 'Q') return t('mana.untap');
  if (clean === 'S') return t('mana.snow');
  if (clean === 'E') return t('mana.energy');
  if (clean === 'P' || clean.includes('/P')) return t('mana.phyrexian');
  if (clean.includes('/')) return t('mana.hybrid');
  return clean;
}

export function parseTextWithSymbols(text: string | undefined, isLarge = false): ReactNode[] {
  if (!text) return [];
  const symbolRegex = /(\{[^}]+\})/g;
  const parts = text.split(symbolRegex);
  return parts.map((part, index) => {
    if (symbolRegex.test(part)) {
      const url = getSymbolUrl(part);
      const sizeClass = isLarge ? 'w-5 h-5 mx-[2px]' : 'w-4 h-4 mx-[1px]';
      return (
        <img
          key={index}
          src={url}
          alt={getSymbolLabel(part)}
          className={`inline-block ${sizeClass} align-middle select-none`}
          style={{ verticalAlign: '-0.12em' }}
        />
      );
    }
    return <span key={index}>{part}</span>;
  });
}
