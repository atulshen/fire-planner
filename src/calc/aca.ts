import { ACA_AGE_FACTORS, ACA_CONTRIBUTION_TABLE, ACA_FPL_BASELINE, GOLD_BASE_21, SILVER_BASE_21 } from '../constants/aca';
import { PLANNING_GROWTH_RATES, scalePlanningAmount } from '../constants/planning';
import { fmt } from '../utils/format';

/**
 * Get the ACA applicable contribution percentage for a given income.
 * Returns null if not eligible (below 100% FPL or above 400% FPL).
 */
export function getAcaContributionPct(income: number): number | null {
  return getAcaContributionPctForFpl(income, ACA_FPL_BASELINE);
}

export function getAcaContributionPctForFpl(income: number, fpl: number): number | null {
  const fplRatio = income / fpl;
  if (fplRatio < 1.0 || fplRatio > 4.0) return null;

  for (let i = 1; i < ACA_CONTRIBUTION_TABLE.length; i++) {
    const prev = ACA_CONTRIBUTION_TABLE[i - 1];
    const curr = ACA_CONTRIBUTION_TABLE[i];
    if (fplRatio <= curr.fpl) {
      const t = (fplRatio - prev.fpl) / (curr.fpl - prev.fpl);
      return prev.pct + t * (curr.pct - prev.pct);
    }
  }
  return 0.0996;
}

/**
 * Estimate the Silver benchmark premium (monthly) for subsidy calculation.
 */
export function estimateBenchmarkPremium(age: number): number {
  const factor = ACA_AGE_FACTORS[Math.min(Math.max(Math.round(age), 0), 64)] || 1.278;
  return Math.round(SILVER_BASE_21 * factor);
}

/**
 * Estimate the Gold plan premium (monthly).
 */
export function estimateGoldPremium(age: number): number {
  const factor = ACA_AGE_FACTORS[Math.min(Math.max(Math.round(age), 0), 64)] || 1.278;
  return Math.round(GOLD_BASE_21 * factor);
}

export interface AcaSubsidyResult {
  eligible: boolean;
  medicaidEligible?: boolean;
  reason?: string;
  subsidy: number;
  goldPremium: number;
  netPremium: number;
  benchmark: number;
  monthlyBenchmark: number;
  monthlyGold: number;
  contribPct?: number;
  fplRatio: number;
}

export function getAcaFpl(
  yearsFromBase = 0,
  inflationRate = PLANNING_GROWTH_RATES.acaThresholds,
): number {
  return scalePlanningAmount(ACA_FPL_BASELINE, yearsFromBase, inflationRate);
}

export function calcAcaSubsidyForFpl(magi: number, age: number, fpl: number): AcaSubsidyResult {
  const fplRatio = magi / fpl;
  const monthlyBenchmark = estimateBenchmarkPremium(age);
  const annualBenchmark = monthlyBenchmark * 12;
  const monthlyGold = estimateGoldPremium(age);
  const annualGold = monthlyGold * 12;

  if (fplRatio < 1.0) {
    return {
      eligible: false,
      medicaidEligible: true,
      reason: 'Below 100% FPL — modeled as Medicaid with $0 medical cost',
      subsidy: 0,
      goldPremium: annualGold,
      netPremium: 0,
      benchmark: annualBenchmark,
      monthlyBenchmark,
      monthlyGold,
      fplRatio,
    };
  }
  if (fplRatio > 4.0) {
    return {
      eligible: false,
      medicaidEligible: false,
      reason: 'Above 400% FPL ($' + fmt(Math.round(fpl * 4)) + ') — no subsidy (cliff)',
      subsidy: 0,
      goldPremium: annualGold,
      netPremium: annualGold,
      benchmark: annualBenchmark,
      monthlyBenchmark,
      monthlyGold,
      fplRatio,
    };
  }

  const contribPct = getAcaContributionPctForFpl(magi, fpl)!;
  const expectedContribution = magi * contribPct;
  const subsidy = Math.max(annualBenchmark - expectedContribution, 0);
  const netPremium = Math.max(annualGold - subsidy, 0);

  return {
    eligible: true,
    medicaidEligible: false,
    subsidy,
    goldPremium: annualGold,
    netPremium,
    benchmark: annualBenchmark,
    monthlyBenchmark,
    monthlyGold,
    contribPct,
    fplRatio,
  };
}

export function calcAcaSubsidyForYear(magi: number, age: number, yearsFromBase = 0, inflationRate = 0): AcaSubsidyResult {
  return calcAcaSubsidyForFpl(magi, age, getAcaFpl(yearsFromBase, inflationRate));
}

/**
 * Calculate ACA subsidy for a given MAGI and age.
 */
export function calcAcaSubsidy(magi: number, age: number): AcaSubsidyResult {
  return calcAcaSubsidyForFpl(magi, age, ACA_FPL_BASELINE);
}

/**
 * Get the ACA cliff amount (400% FPL).
 */
export function getAcaCliff(yearsFromBase = 0, inflationRate = 0): number {
  return getAcaFpl(yearsFromBase, inflationRate) * 4;
}
