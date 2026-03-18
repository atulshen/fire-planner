import { TAX_BRACKETS_2026, STANDARD_DEDUCTION, LTCG_BRACKETS_2026 } from '../constants/tax';
import type { TaxBracket, TaxResult } from '../types';

function inflateAmount(amount: number, yearsFromStart = 0, inflationRate = 0): number {
  return amount * Math.pow(1 + inflationRate, yearsFromStart);
}

function inflateBrackets(brackets: TaxBracket[], yearsFromStart = 0, inflationRate = 0): TaxBracket[] {
  return brackets.map((bracket) => ({
    min: inflateAmount(bracket.min, yearsFromStart, inflationRate),
    max: Number.isFinite(bracket.max) ? inflateAmount(bracket.max, yearsFromStart, inflationRate) : Infinity,
    rate: bracket.rate,
  }));
}

export function getInflationAdjustedStandardDeduction(yearsFromStart = 0, inflationRate = 0): number {
  return inflateAmount(STANDARD_DEDUCTION, yearsFromStart, inflationRate);
}

export function getInflationAdjustedOrdinaryBrackets(yearsFromStart = 0, inflationRate = 0): TaxBracket[] {
  return inflateBrackets(TAX_BRACKETS_2026, yearsFromStart, inflationRate);
}

export function getInflationAdjustedLtcgBrackets(yearsFromStart = 0, inflationRate = 0): TaxBracket[] {
  return inflateBrackets(LTCG_BRACKETS_2026, yearsFromStart, inflationRate);
}

export function getTopOfOrdinaryBracketGrossIncome(
  targetRate: number,
  yearsFromStart = 0,
  inflationRate = 0,
): number {
  const deduction = getInflationAdjustedStandardDeduction(yearsFromStart, inflationRate);
  const brackets = getInflationAdjustedOrdinaryBrackets(yearsFromStart, inflationRate);
  const targetBracket = brackets.find((bracket) => bracket.rate === targetRate);
  if (!targetBracket || !Number.isFinite(targetBracket.max)) return deduction;
  return deduction + targetBracket.max;
}

/**
 * Calculate progressive federal income tax for a given gross income (single filer).
 * Applies standard deduction automatically.
 */
export function calcProgressiveTax(income: number, yearsFromStart = 0, inflationRate = 0): TaxResult {
  const deduction = getInflationAdjustedStandardDeduction(yearsFromStart, inflationRate);
  const taxable = Math.max(income - deduction, 0);
  const brackets = getInflationAdjustedOrdinaryBrackets(yearsFromStart, inflationRate);
  let tax = 0;

  for (const bracket of brackets) {
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
export function calcLongTermCapitalGainsTax(
  ordinaryIncome: number,
  capitalGains: number,
  yearsFromStart = 0,
  inflationRate = 0,
): TaxResult {
  const deduction = getInflationAdjustedStandardDeduction(yearsFromStart, inflationRate);
  const taxableOrdinaryIncome = Math.max(ordinaryIncome - deduction, 0);
  const remainingDeduction = Math.max(deduction - ordinaryIncome, 0);
  const taxableCapitalGains = Math.max(capitalGains - remainingDeduction, 0);
  const brackets = getInflationAdjustedLtcgBrackets(yearsFromStart, inflationRate);

  let tax = 0;
  let remainingGains = taxableCapitalGains;

  for (const bracket of brackets) {
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

export function calcFederalIncomeTax(
  ordinaryIncome: number,
  capitalGains = 0,
  yearsFromStart = 0,
  inflationRate = 0,
): {
  ordinaryTax: number;
  capitalGainsTax: number;
  totalTax: number;
  effectiveRate: number;
} {
  const ordinaryTax = calcProgressiveTax(ordinaryIncome, yearsFromStart, inflationRate).tax;
  const capitalGainsTax = calcLongTermCapitalGainsTax(ordinaryIncome, capitalGains, yearsFromStart, inflationRate).tax;
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
export function getMarginalRate(income: number, yearsFromStart = 0, inflationRate = 0): number {
  const deduction = getInflationAdjustedStandardDeduction(yearsFromStart, inflationRate);
  const taxable = Math.max(income - deduction, 0);
  const brackets = getInflationAdjustedOrdinaryBrackets(yearsFromStart, inflationRate);
  for (let i = brackets.length - 1; i >= 0; i--) {
    if (taxable > brackets[i].min) {
      return brackets[i].rate;
    }
  }
  return brackets[0].rate;
}

/**
 * Calculate progressive tax with bracket fill details.
 * Unlike calcProgressiveTax, returns bracketFill array for visualization.
 */
export function calcProgressiveTaxDetailed(income: number): { tax: number; bracketFill: any[]; effectiveRate: number } {
  const deduction = getInflationAdjustedStandardDeduction();
  const taxable = Math.max(income - deduction, 0);
  let tax = 0;
  let remaining = taxable;
  const bracketFill: any[] = [];
  for (const b of getInflationAdjustedOrdinaryBrackets()) {
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
export function findOptimalConversionAmount(otherIncome: number, yearsFromStart = 0, inflationRate = 0): number {
  const deduction = getInflationAdjustedStandardDeduction(yearsFromStart, inflationRate);
  const taxableOther = Math.max(otherIncome - deduction, 0);
  const topOf22 = getInflationAdjustedOrdinaryBrackets(yearsFromStart, inflationRate)
    .find((bracket) => bracket.rate === 0.22)?.max ?? 0;
  const roomIn22 = Math.max(topOf22 - taxableOther, 0);
  return roomIn22;
}
