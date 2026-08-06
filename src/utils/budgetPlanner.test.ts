import { describe, it, expect } from 'vitest';
import { planBudgetCuts } from './budgetPlanner';

const cards = [
  { id: '1', name: 'A', price: 20 },
  { id: '2', name: 'B', price: 15 },
  { id: '3', name: 'C', price: 5 }
];

describe('planBudgetCuts', () => {
  it('returns no cuts when the deck is within budget', () => {
    expect(planBudgetCuts(cards, 40, 50)).toEqual({ overBy: 0, cuts: [] });
  });

  it('returns no cuts when no target is set', () => {
    expect(planBudgetCuts(cards, 40, 0)).toEqual({ overBy: 0, cuts: [] });
  });

  it('suggests the fewest priciest cards to get under the target', () => {
    const plan = planBudgetCuts(cards, 40, 25); // over by 15 -> drop A (20)
    expect(plan.overBy).toBe(15);
    expect(plan.cuts.map((c) => c.id)).toEqual(['1']);
  });

  it('accumulates multiple cuts until under the target', () => {
    const plan = planBudgetCuts(cards, 40, 2); // over by 38 -> A+B = 35 < 38 -> +C
    expect(plan.cuts.map((c) => c.id)).toEqual(['1', '2', '3']);
  });

  it('sorts by price regardless of input order and skips free cards', () => {
    const unsorted = [
      { id: 'free', name: 'Free', price: 0 },
      { id: 'cheap', name: 'Cheap', price: 4 },
      { id: 'pricey', name: 'Pricey', price: 12 }
    ];
    const plan = planBudgetCuts(unsorted, 16, 5); // over by 11 -> Pricey(12) covers it
    expect(plan.cuts.map((c) => c.id)).toEqual(['pricey']);
  });
});
