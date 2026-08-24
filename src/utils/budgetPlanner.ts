export interface BudgetCard {
  id: string;
  name: string;
  price: number;
}

export interface BudgetPlan {
  /** 0 when the deck is within budget. */
  overBy: number;
  /** The priciest cards first, cut until the deck is back under the target. */
  cuts: BudgetCard[];
}

/** A target of zero or less means no budget was set, and nothing is ever suggested for cutting. */
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
