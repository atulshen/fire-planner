import type { Holding, TaxEfficiencyAnalysis, TaxEfficiencyResult, TaxEfficiencyMove } from '../types';
import { TAX_LOCATION_RULES } from '../constants/tax';
import { ACCOUNT_LABELS } from '../constants/categories';

function normalizeAccountForTaxPlacement(account: Holding['account']): Holding['account'] {
  return account === 'hsa' ? 'roth' : account;
}

/**
 * Analyze the tax efficiency of the current portfolio placement.
 * Returns per-holding scores and suggested moves.
 */
export function analyzeTaxEfficiency(holdings: Holding[]): TaxEfficiencyAnalysis {
  const results: TaxEfficiencyResult[] = [];
  const moves: TaxEfficiencyMove[] = [];
  let totalValue = 0;
  let weightedScore = 0;

  for (const h of holdings) {
    const val = h.shares * h.price;
    totalValue += val;

    const rule = TAX_LOCATION_RULES[h.category] || TAX_LOCATION_RULES.other;
    const idealOrder = rule.ideal;
    const currentRank = idealOrder.indexOf(normalizeAccountForTaxPlacement(h.account));

    let score: number, status: 'ok' | 'warn' | 'bad';
    if (currentRank === 0) {
      score = 100; status = 'ok';
    } else if (currentRank === 1) {
      score = 60; status = 'warn';
    } else {
      score = 20; status = 'bad';
    }

    const bestAccount = idealOrder[0];
    let moveReason: string | null = null;
    if (currentRank > 0) {
      moveReason = `Move from ${ACCOUNT_LABELS[h.account]} to ${ACCOUNT_LABELS[bestAccount]} — ${rule.reason.toLowerCase()}`;
    }

    results.push({
      ticker: h.ticker,
      name: h.name,
      category: h.category,
      account: h.account,
      value: val,
      score,
      status,
      idealAccount: bestAccount,
      moveReason,
    });

    if (currentRank > 0 && val > 500) {
      moves.push({
        ticker: h.ticker,
        category: h.category,
        from: h.account,
        to: bestAccount,
        value: val,
        reason: moveReason!,
        severity: currentRank,
      });
    }

    weightedScore += score * val;
  }

  const overallScore = totalValue > 0 ? Math.round(weightedScore / totalValue) : 100;
  return { results, moves, overallScore, totalValue };
}
