import { FPL_2025, ACA_CONTRIBUTION_TABLE, ACA_AGE_FACTORS, SILVER_BASE_21, GOLD_BASE_21 } from '../constants/aca';
import { fmt } from '../utils/format';

/**
 * Get the ACA applicable contribution percentage for a given income.
 * Returns null if not eligible (below 100% FPL or above 400% FPL).
 */
export function getAcaContributionPct(income: number): number | null {
  const fplRatio = income / FPL_2025;
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

/**
 * Calculate ACA subsidy for a given MAGI and age.
 */
export function calcAcaSubsidy(magi: number, age: number): AcaSubsidyResult {
  const fplRatio = magi / FPL_2025;
  const monthlyBenchmark = estimateBenchmarkPremium(age);
  const annualBenchmark = monthlyBenchmark * 12;
  const monthlyGold = estimateGoldPremium(age);
  const annualGold = monthlyGold * 12;

  if (fplRatio < 1.0) {
    return { eligible: false, reason: 'Below 100% FPL — Medicaid eligible in most states', subsidy: 0, goldPremium: annualGold, netPremium: annualGold, benchmark: annualBenchmark, monthlyBenchmark, monthlyGold, fplRatio };
  }
  if (fplRatio > 4.0) {
    return { eligible: false, reason: 'Above 400% FPL ($' + fmt(Math.round(FPL_2025 * 4)) + ') — no subsidy (cliff)', subsidy: 0, goldPremium: annualGold, netPremium: annualGold, benchmark: annualBenchmark, monthlyBenchmark, monthlyGold, fplRatio };
  }

  const contribPct = getAcaContributionPct(magi)!;
  const expectedContribution = magi * contribPct;
  const subsidy = Math.max(annualBenchmark - expectedContribution, 0);
  const netPremium = Math.max(annualGold - subsidy, 0);

  return {
    eligible: true,
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

/**
 * Get the ACA cliff amount (400% FPL).
 */
export function getAcaCliff(): number {
  return FPL_2025 * 4;
}
