import { TAX_BRACKETS_2026, STANDARD_DEDUCTION } from '../constants/tax';
import type { TaxResult } from '../types';

/**
 * Calculate progressive federal income tax for a given gross income (single filer).
 * Applies standard deduction automatically.
 */
export function calcProgressiveTax(income: number): TaxResult {
  const taxable = Math.max(income - STANDARD_DEDUCTION, 0);
  let tax = 0;

  for (const bracket of TAX_BRACKETS_2026) {
    if (taxable <= bracket.min) break;
    const bracketIncome = Math.min(taxable, bracket.max) - bracket.min;
    tax += bracketIncome * bracket.rate;
  }

  const effectiveRate = income > 0 ? tax / income : 0;
  return { tax, effectiveRate };
}

/**
 * Get the marginal tax rate for a given income level.
 */
export function getMarginalRate(income: number): number {
  const taxable = Math.max(income - STANDARD_DEDUCTION, 0);
  for (let i = TAX_BRACKETS_2026.length - 1; i >= 0; i--) {
    if (taxable > TAX_BRACKETS_2026[i].min) {
      return TAX_BRACKETS_2026[i].rate;
    }
  }
  return TAX_BRACKETS_2026[0].rate;
}

/**
 * Calculate progressive tax with bracket fill details.
 * Unlike calcProgressiveTax, returns bracketFill array for visualization.
 */
export function calcProgressiveTaxDetailed(income: number): { tax: number; bracketFill: any[]; effectiveRate: number } {
  const taxable = Math.max(income - STANDARD_DEDUCTION, 0);
  let tax = 0;
  let remaining = taxable;
  const bracketFill: any[] = [];
  for (const b of TAX_BRACKETS_2026) {
    const width = b.max - b.min;
    const inBracket = Math.min(remaining, width);
    tax += inBracket * b.rate;
    bracketFill.push({ ...b, filled: inBracket, width });
    remaining -= inBracket;
    if (remaining <= 0) break;
  }
  return { tax, bracketFill, effectiveRate: income > 0 ? tax / income : 0 };
}

/**
 * Find the optimal Roth conversion amount by filling up to the top of the 22% bracket.
 */
export function findOptimalConversionAmount(otherIncome: number): number {
  const taxableOther = Math.max(otherIncome - STANDARD_DEDUCTION, 0);
  const topOf22 = 100525; // top of 22% bracket
  const roomIn22 = Math.max(topOf22 - taxableOther, 0);
  return roomIn22;
}
