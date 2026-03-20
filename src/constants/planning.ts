import type { TaxBracket } from '../types';

export const PLANNING_BASE_YEAR = 2026;

export const PLANNING_GROWTH_RATES = {
  federalThresholds: 0.025,
  acaThresholds: 0.025,
  healthcareCosts: 0.03,
} as const;

export function scalePlanningAmount(amount: number, yearsFromBase = 0, annualRate = 0): number {
  return amount * Math.pow(1 + annualRate, Math.max(yearsFromBase, 0));
}

export function scalePlanningBrackets(
  brackets: TaxBracket[],
  yearsFromBase = 0,
  annualRate = 0,
): TaxBracket[] {
  return brackets.map((bracket) => ({
    min: scalePlanningAmount(bracket.min, yearsFromBase, annualRate),
    max: Number.isFinite(bracket.max)
      ? scalePlanningAmount(bracket.max, yearsFromBase, annualRate)
      : Infinity,
    rate: bracket.rate,
  }));
}
