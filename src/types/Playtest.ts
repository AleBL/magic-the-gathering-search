import { Card } from './Card';
import { PlaytestZone } from './enums';

export interface PlaytestCard {
  playtestId: string; // Unique ID to track card instances independently in simulator
  card: Card;
  isTapped: boolean;
  counters?: number;
  isFaceDown?: boolean;
  /** The whole double-faced card while `card` holds one chosen face; restored on leaving play. */
  baseCard?: Card;
}

export interface LogEntry {
  id: string;
  text: string;
  timestamp: string;
}

// Zone subsets derived from the canonical PlaytestZone so they never drift apart.
export type PlaytestDragZone = PlaytestZone;
export type PlaytestMenuZone = Exclude<PlaytestZone, typeof PlaytestZone.LIBRARY>;
export type PlaytestPileZone = Extract<PlaytestZone, 'library' | 'graveyard' | 'exile'>;
export type ScrySurveilType = 'scry' | 'surveil';

/** Payload encoded via `dataTransfer.setData('text/plain', JSON.stringify(...))` during a playtest drag. */
export interface PlaytestDragData {
  id: string;
  source: PlaytestDragZone;
}
