import { TAX_BRACKETS_2026, STANDARD_DEDUCTION, LTCG_BRACKETS_2026 } from '../constants/tax';
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
 * Calculate federal long-term capital gains tax for a single filer.
 * The standard deduction is applied against ordinary income first and then any remaining deduction shelters gains.
 */
export function calcLongTermCapitalGainsTax(ordinaryIncome: number, capitalGains: number): TaxResult {
  const taxableOrdinaryIncome = Math.max(ordinaryIncome - STANDARD_DEDUCTION, 0);
  const remainingDeduction = Math.max(STANDARD_DEDUCTION - ordinaryIncome, 0);
  const taxableCapitalGains = Math.max(capitalGains - remainingDeduction, 0);

  let tax = 0;
  let remainingGains = taxableCapitalGains;

  for (const bracket of LTCG_BRACKETS_2026) {
    if (remainingGains <= 0) break;
    const bracketRoom = Math.max(bracket.max - Math.max(taxableOrdinaryIncome, bracket.min), 0);
    if (bracketRoom <= 0) continue;
    const gainsInBracket = Math.min(remainingGains, bracketRoom);
    tax += gainsInBracket * bracket.rate;
    remainingGains -= gainsInBracket;
  }

  const effectiveRate = capitalGains > 0 ? tax / capitalGains : 0;
  return { tax, effectiveRate };
}

export function calcFederalIncomeTax(ordinaryIncome: number, capitalGains = 0): {
  ordinaryTax: number;
  capitalGainsTax: number;
  totalTax: number;
  effectiveRate: number;
} {
  const ordinaryTax = calcProgressiveTax(ordinaryIncome).tax;
  const capitalGainsTax = calcLongTermCapitalGainsTax(ordinaryIncome, capitalGains).tax;
  const grossIncome = ordinaryIncome + capitalGains;
  return {
    ordinaryTax,
    capitalGainsTax,
    totalTax: ordinaryTax + capitalGainsTax,
    effectiveRate: grossIncome > 0 ? (ordinaryTax + capitalGainsTax) / grossIncome : 0,
  };
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
