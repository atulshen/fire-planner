import {
  ADDITIONAL_MEDICARE_RATE,
  ADDITIONAL_MEDICARE_THRESHOLD_SINGLE,
  LTCG_TAX_BRACKETS_BASELINE,
  MEDICARE_PAYROLL_RATE,
  NET_INVESTMENT_INCOME_TAX_RATE,
  NET_INVESTMENT_INCOME_TAX_THRESHOLD_MARRIED,
  NET_INVESTMENT_INCOME_TAX_THRESHOLD_SINGLE,
  ORDINARY_TAX_BRACKETS_BASELINE,
  SOCIAL_SECURITY_PAYROLL_RATE,
  SOCIAL_SECURITY_WAGE_BASE_BASELINE,
  STANDARD_DEDUCTION_BASELINE,
} from '../constants/tax';
import { PLANNING_GROWTH_RATES, scalePlanningAmount, scalePlanningBrackets } from '../constants/planning';
import type { FilingStatus, TaxBracket, TaxResult } from '../types';

const SS_BASE_AMOUNT_SINGLE = 25000;
const SS_ADJUSTED_BASE_SINGLE = 34000;

export function getInflationAdjustedStandardDeduction(
  yearsFromStart = 0,
  inflationRate = PLANNING_GROWTH_RATES.federalThresholds,
): number {
  return scalePlanningAmount(STANDARD_DEDUCTION_BASELINE, yearsFromStart, inflationRate);
}

export function getInflationAdjustedSocialSecurityWageBase(
  yearsFromStart = 0,
  inflationRate = PLANNING_GROWTH_RATES.federalThresholds,
): number {
  return scalePlanningAmount(SOCIAL_SECURITY_WAGE_BASE_BASELINE, yearsFromStart, inflationRate);
}

export function getInflationAdjustedOrdinaryBrackets(
  yearsFromStart = 0,
  inflationRate = PLANNING_GROWTH_RATES.federalThresholds,
): TaxBracket[] {
  return scalePlanningBrackets(ORDINARY_TAX_BRACKETS_BASELINE, yearsFromStart, inflationRate);
}

export function getInflationAdjustedLtcgBrackets(
  yearsFromStart = 0,
  inflationRate = PLANNING_GROWTH_RATES.federalThresholds,
): TaxBracket[] {
  return scalePlanningBrackets(LTCG_TAX_BRACKETS_BASELINE, yearsFromStart, inflationRate);
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

export function calcTaxableSocialSecurity(
  otherOrdinaryIncome: number,
  capitalGains = 0,
  socialSecurityIncome = 0,
): number {
  if (socialSecurityIncome <= 0) return 0;

  const provisionalIncome = otherOrdinaryIncome + capitalGains + (socialSecurityIncome * 0.5);
  if (provisionalIncome <= SS_BASE_AMOUNT_SINGLE) return 0;

  if (provisionalIncome <= SS_ADJUSTED_BASE_SINGLE) {
    return Math.min((provisionalIncome - SS_BASE_AMOUNT_SINGLE) * 0.5, socialSecurityIncome * 0.5);
  }

  const taxableAboveAdjusted = (provisionalIncome - SS_ADJUSTED_BASE_SINGLE) * 0.85;
  const priorTierTaxable = Math.min((SS_ADJUSTED_BASE_SINGLE - SS_BASE_AMOUNT_SINGLE) * 0.5, socialSecurityIncome * 0.5);
  return Math.min(taxableAboveAdjusted + priorTierTaxable, socialSecurityIncome * 0.85);
}

export function calcPayrollTax(
  wageIncome: number,
  yearsFromStart = 0,
  inflationRate = 0,
): {
  socialSecurityTax: number;
  medicareTax: number;
  additionalMedicareTax: number;
  totalTax: number;
  effectiveRate: number;
} {
  const wages = Math.max(wageIncome, 0);
  const ssWageBase = getInflationAdjustedSocialSecurityWageBase(yearsFromStart, inflationRate);
  const socialSecurityTax = Math.min(wages, ssWageBase) * SOCIAL_SECURITY_PAYROLL_RATE;
  const medicareTax = wages * MEDICARE_PAYROLL_RATE;
  const additionalMedicareTax = Math.max(wages - ADDITIONAL_MEDICARE_THRESHOLD_SINGLE, 0) * ADDITIONAL_MEDICARE_RATE;
  const totalTax = socialSecurityTax + medicareTax + additionalMedicareTax;
  return {
    socialSecurityTax,
    medicareTax,
    additionalMedicareTax,
    totalTax,
    effectiveRate: wages > 0 ? totalTax / wages : 0,
  };
}

/**
 * Calculate progressive federal income tax for a given gross income (single filer).
 * Uses the 2026 planning baseline and applies the standard deduction automatically.
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
 * Uses the 2026 planning baseline. The standard deduction is applied against
 * ordinary income first and then any remaining deduction shelters gains.
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

export function getNetInvestmentIncomeTaxThreshold(filingStatus: FilingStatus = 'single'): number {
  return filingStatus === 'married'
    ? NET_INVESTMENT_INCOME_TAX_THRESHOLD_MARRIED
    : NET_INVESTMENT_INCOME_TAX_THRESHOLD_SINGLE;
}

export function calcNetInvestmentIncomeTax(
  magi: number,
  netInvestmentIncome: number,
  filingStatus: FilingStatus = 'single',
): TaxResult {
  const threshold = getNetInvestmentIncomeTaxThreshold(filingStatus);
  const taxableBase = Math.min(
    Math.max(magi - threshold, 0),
    Math.max(netInvestmentIncome, 0),
  );
  const tax = taxableBase * NET_INVESTMENT_INCOME_TAX_RATE;
  return {
    tax,
    effectiveRate: netInvestmentIncome > 0 ? tax / netInvestmentIncome : 0,
  };
}

export function estimateForeignTaxCredit(
  foreignTaxPaid: number,
  foreignSourceIncome: number,
  totalTaxableIncome: number,
  regularFederalTax: number,
): {
  limitation: number;
  allowableCredit: number;
  disallowedCredit: number;
} {
  const limitation = totalTaxableIncome > 0
    ? regularFederalTax * Math.min(Math.max(foreignSourceIncome, 0) / totalTaxableIncome, 1)
    : 0;
  const allowableCredit = Math.min(Math.max(foreignTaxPaid, 0), limitation);
  return {
    limitation,
    allowableCredit,
    disallowedCredit: Math.max(foreignTaxPaid - allowableCredit, 0),
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
