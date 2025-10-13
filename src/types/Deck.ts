import { Card } from './Card';

export interface Deck {
  id: string;
  name: string;
  cards: Card[];
  createdAt: string;
}

