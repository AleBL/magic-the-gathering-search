import { Card } from '../types/Card';
import { readRequestError } from './typeGuards';

/**
 * One entry per card, preferring the printing in the reader's language. A printing with no
 * `oracle_id` (reversible cards, and anything Scryfall trims) would key every such card under
 * the same `undefined` and collapse them into a single result, so it falls back to its id.
 */
export function deduplicateCards(combined: Card[], targetLang: string): Card[] {
  const cleanLang = (targetLang || 'en').split('-')[0].toLowerCase();
  const byCard = new Map<string, Card>();

  combined.forEach((card) => {
    const key = card.oracle_id || card.id;
    const existing = byCard.get(key);
    if (!existing) {
      byCard.set(key, card);
      return;
    }
    const existingIsEnglish = existing.lang === 'en' || !existing.lang;
    if (existingIsEnglish && card.lang === cleanLang) {
      byCard.set(key, card);
    }
  });

  return Array.from(byCard.values());
}

/** Adds the English results the localized search did not already cover. */
export function mergeLanguageResults(preferred: Card[], english: Card[]): Card[] {
  const seen = new Set(preferred.map((card) => card.oracle_id));
  return [...preferred, ...english.filter((card) => !seen.has(card.oracle_id))];
}

/**
 * Which message a failed search should show, or null when the failure is not one the user can
 * act on. Scryfall answers a rate limit and an outage with statuses the SDK sometimes reports
 * as a status and sometimes only inside the message, so both are read.
 */
export function scryfallSearchErrorKey(error: unknown): 'search.rateLimited' | 'search.scryfallOffline' | null {
  const { status, message } = readRequestError(error);
  const lowerMessage = message.toLowerCase();

  if (status === 429 || message.includes('429')) return 'search.rateLimited';
  if (
    status === 503 ||
    status === 504 ||
    message.includes('503') ||
    message.includes('504') ||
    lowerMessage.includes('offline') ||
    lowerMessage.includes('maintenance') ||
    lowerMessage.includes('timed out')
  ) {
    return 'search.scryfallOffline';
  }
  return null;
}

/** True when the browser itself reports no connection, which explains an empty result list. */
export const isBrowserOffline = (): boolean => typeof navigator !== 'undefined' && navigator.onLine === false;
