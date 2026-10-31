import { describe, expect, it } from 'vitest';
import { recompute } from '../components/BudgetPanel';
import { addDays, distanceKm, km, minutes } from './format';
import type { BudgetSummary, Expense } from './types';

const base: BudgetSummary = {
  budget: 10000,
  travellers: 2,
  plannedTotal: 8000,
  actualTotal: 0,
  remaining: 10000,
  perPersonPlanned: 4000,
  perPersonActual: 0,
  lines: [
    { category: 'food', planned: 3000, actual: 0 },
    { category: 'transport', planned: 5000, actual: 0 },
  ],
};

const exp = (category: Expense['category'], amount: number): Expense => ({
  id: `${category}-${amount}`, category, amount, spentOn: '2026-12-10', userId: 'u', userName: 'U', canDelete: true,
});

describe('budget recompute', () => {
  it('sums actuals per category and updates remaining/per-person', () => {
    const r = recompute(base, [exp('food', 500), exp('food', 700), exp('transport', 1800)]);
    expect(r.lines.find((l) => l.category === 'food')?.actual).toBe(1200);
    expect(r.actualTotal).toBe(3000);
    expect(r.remaining).toBe(7000);
    expect(r.perPersonActual).toBe(1500);
    expect(r.plannedTotal).toBe(8000);
  });

  it('allows going over budget', () => {
    expect(recompute(base, [exp('food', 12000)]).remaining).toBe(-2000);
  });
});

describe('format helpers', () => {
  it('adds days using local calendar dates (no UTC rollover)', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('formats durations and distances', () => {
    expect(minutes(45)).toBe('45 min');
    expect(minutes(125)).toBe('2 h 5 min');
    expect(km(0.25)).toBe('250 m');
    expect(km(12.4)).toBe('12 km');
  });

  it('computes haversine distance', () => {
    // Taj Mahal → Agra Fort ≈ 2.1 km
    expect(distanceKm({ lat: 27.1751, lng: 78.0421 }, { lat: 27.1795, lng: 78.0211 })).toBeCloseTo(2.13, 1);
  });
});
