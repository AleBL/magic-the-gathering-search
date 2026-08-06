export interface BudgetCard {
  id: string;
  name: string;
  price: number;
}

export interface BudgetPlan {
  /** How much the deck total exceeds the target (0 when within budget). */
  overBy: number;
  /** Fewest priciest cards to remove to get back under the target. */
  cuts: BudgetCard[];
}

/**
 * Greedy budget planner: given a deck's priced cards, its total and a target
 * budget, returns how far over budget it is and the fewest most-expensive cards
 * to drop to get back under the target. A non-positive target means "no target".
 */
export function planBudgetCuts(cards: BudgetCard[], total: number, target: number): BudgetPlan {
  const overBy = total - target;
  if (!(target > 0) || overBy <= 0) return { overBy: 0, cuts: [] };

  const sorted = [...cards].sort((a, b) => b.price - a.price);
  const cuts: BudgetCard[] = [];
  let saved = 0;
  for (const card of sorted) {
    if (saved >= overBy) break;
    if (card.price <= 0) continue;
    cuts.push(card);
    saved += card.price;
  }
  return { overBy, cuts };
}
