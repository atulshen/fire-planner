import type {
  CategoryKey,
  Holding,
  PortfolioRecommendation,
  TaxEfficiencyAnalysis,
  TaxEfficiencyMove,
  TaxEfficiencyResult,
} from '../types';
import { TAX_LOCATION_RULES } from '../constants/tax';
import { ACCOUNT_LABELS, CATEGORIES } from '../constants/categories';
import { getEffectiveAllocation } from './allocation';

function normalizeAccountForTaxPlacement(account: Holding['account']): Holding['account'] {
  return account === 'hsa' ? 'roth' : account;
}

const CATEGORY_ACCOUNT_TAX_DRAG: Record<CategoryKey, Record<'roth' | 'ira' | 'taxable', number>> = {
  us_stock: { roth: 0.001, ira: 0.006, taxable: 0.003 },
  intl_stock: { roth: 0.003, ira: 0.005, taxable: 0.002 },
  bond: { roth: 0.010, ira: 0.002, taxable: 0.016 },
  muni: { roth: 0.003, ira: 0.004, taxable: 0.0005 },
  reit: { roth: 0.012, ira: 0.003, taxable: 0.015 },
  cash: { roth: 0.005, ira: 0.001, taxable: 0.008 },
  crypto: { roth: 0.0005, ira: 0.010, taxable: 0.006 },
  other: { roth: 0.002, ira: 0.004, taxable: 0.005 },
};

function categoryLabel(category: CategoryKey): string {
  return CATEGORIES[category]?.label || category;
}

function estimateAnnualTaxDragSaved(
  category: CategoryKey,
  from: 'roth' | 'ira' | 'taxable',
  to: 'roth' | 'ira' | 'taxable',
  amount: number,
): number {
  const drag = CATEGORY_ACCOUNT_TAX_DRAG[category];
  return Math.max((drag[from] - drag[to]) * amount, 0);
}

function formatAccountLabel(account: Holding['account']): string {
  return ACCOUNT_LABELS[account];
}

function getBestTaxAccount(category: CategoryKey): 'roth' | 'ira' | 'taxable' {
  const best = TAX_LOCATION_RULES[category]?.ideal?.[0] || 'taxable';
  return normalizeAccountForTaxPlacement(best) as 'roth' | 'ira' | 'taxable';
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

export function analyzePortfolioRecommendations(
  holdings: Holding[],
  targets: Record<CategoryKey, number>,
): PortfolioRecommendation[] {
  if (holdings.length === 0) return [];

  const totalValue = holdings.reduce((sum, holding) => sum + (holding.shares * holding.price), 0);
  if (totalValue <= 0) return [];

  const byCategory: Record<CategoryKey, number> = {
    us_stock: 0,
    intl_stock: 0,
    bond: 0,
    muni: 0,
    reit: 0,
    cash: 0,
    crypto: 0,
    other: 0,
  };

  const taxableCash = holdings
    .filter((holding) => holding.account === 'taxable' && holding.category === 'cash')
    .reduce((sum, holding) => sum + (holding.shares * holding.price), 0);

  for (const holding of holdings) {
    const allocation = getEffectiveAllocation(holding);
    for (const [category, amount] of Object.entries(allocation) as Array<[CategoryKey, number]>) {
      byCategory[category] += amount;
    }
  }

  const recommendations: PortfolioRecommendation[] = [];
  const underweights = (Object.entries(targets) as Array<[CategoryKey, number]>)
    .map(([category, targetPct]) => {
      const actualPct = (byCategory[category] / totalValue) * 100;
      const diffPct = targetPct - actualPct;
      return {
        category,
        targetPct,
        actualPct,
        diffPct,
        amount: Math.max((diffPct / 100) * totalValue, 0),
      };
    })
    .filter((item) => item.diffPct > 2)
    .sort((a, b) => b.amount - a.amount);

  const pushRec = (rec: PortfolioRecommendation): void => {
    recommendations.push(rec);
  };

  type Pool = { category: CategoryKey; remaining: number; annualSavingsRate: number };
  const iraToRothPools: Pool[] = [];
  const rothToIraPools: Pool[] = [];

  const categoryAccountValue = new Map<string, number>();
  for (const holding of holdings) {
    const normalizedAccount = normalizeAccountForTaxPlacement(holding.account) as 'roth' | 'ira' | 'taxable';
    const value = holding.shares * holding.price;
    const key = `${holding.category}:${normalizedAccount}`;
    categoryAccountValue.set(key, (categoryAccountValue.get(key) || 0) + value);
  }

  for (const [key, value] of categoryAccountValue.entries()) {
    if (value < 500) continue;
    const [categoryRaw, accountRaw] = key.split(':');
    const category = categoryRaw as CategoryKey;
    const account = accountRaw as 'roth' | 'ira' | 'taxable';
    const best = getBestTaxAccount(category);
    if (account === 'ira' && best === 'roth') {
      iraToRothPools.push({
        category,
        remaining: value,
        annualSavingsRate: CATEGORY_ACCOUNT_TAX_DRAG[category].ira - CATEGORY_ACCOUNT_TAX_DRAG[category].roth,
      });
    }
    if (account === 'roth' && best === 'ira') {
      rothToIraPools.push({
        category,
        remaining: value,
        annualSavingsRate: CATEGORY_ACCOUNT_TAX_DRAG[category].roth - CATEGORY_ACCOUNT_TAX_DRAG[category].ira,
      });
    }
  }

  iraToRothPools.sort((a, b) => (b.remaining * b.annualSavingsRate) - (a.remaining * a.annualSavingsRate));
  rothToIraPools.sort((a, b) => (b.remaining * b.annualSavingsRate) - (a.remaining * a.annualSavingsRate));

  let swapCount = 0;
  while (iraToRothPools.length > 0 && rothToIraPools.length > 0 && swapCount < 3) {
    const iraPool = iraToRothPools[0];
    const rothPool = rothToIraPools[0];
    const amount = Math.min(iraPool.remaining, rothPool.remaining);
    const annualTaxDragSaved =
      estimateAnnualTaxDragSaved(iraPool.category, 'ira', 'roth', amount) +
      estimateAnnualTaxDragSaved(rothPool.category, 'roth', 'ira', amount);

    pushRec({
      title: `Swap ${categoryLabel(iraPool.category)} in IRA with ${categoryLabel(rothPool.category)} in Roth/HSA`,
      summary: `Tax-free exchange across retirement accounts. This improves tax location on both sides without realizing taxable gains.`,
      amount,
      priority: 2_000_000 + annualTaxDragSaved,
      bucket: 'do_now',
      action: 'swap',
      taxImpact: 'none',
      estimatedAnnualTaxDragSaved: annualTaxDragSaved,
      tags: ['Actionable now', 'No tax hit'],
    });

    iraPool.remaining -= amount;
    rothPool.remaining -= amount;
    if (iraPool.remaining < 500) iraToRothPools.shift();
    if (rothPool.remaining < 500) rothToIraPools.shift();
    swapCount += 1;
  }

  for (const pool of iraToRothPools) {
    pushRec({
      title: `Future Roth funding for ${categoryLabel(pool.category)}`,
      summary: `This category is sitting in Traditional IRA, but Roth/HSA is the better shelter. No offsetting Roth/HSA assets are available for a clean swap right now.`,
      amount: pool.remaining,
      priority: 100_000 + (pool.remaining * pool.annualSavingsRate),
      bucket: 'future',
      action: 'future',
      taxImpact: 'none',
      estimatedAnnualTaxDragSaved: estimateAnnualTaxDragSaved(pool.category, 'ira', 'roth', pool.remaining),
      tags: ['Future contributions'],
    });
  }

  for (const pool of rothToIraPools) {
    pushRec({
      title: `Future IRA funding for ${categoryLabel(pool.category)}`,
      summary: `This category is sitting in Roth/HSA, but Traditional IRA is the better location. No offsetting IRA assets are available for a clean swap right now.`,
      amount: pool.remaining,
      priority: 100_000 + (pool.remaining * pool.annualSavingsRate),
      bucket: 'future',
      action: 'future',
      taxImpact: 'none',
      estimatedAnnualTaxDragSaved: estimateAnnualTaxDragSaved(pool.category, 'roth', 'ira', pool.remaining),
      tags: ['Future contributions'],
    });
  }

  let remainingTaxableCash = taxableCash;
  const taxableCashAllocated = new Map<CategoryKey, number>();
  for (const underweight of underweights) {
    if (remainingTaxableCash < 500) break;
    const amount = Math.min(underweight.amount, remainingTaxableCash);
    if (amount < 500) continue;
    const bestAccount = TAX_LOCATION_RULES[underweight.category]?.ideal?.[0] || 'taxable';
    pushRec({
      title: `Use taxable cash to buy ${categoryLabel(underweight.category)}`,
      summary: `${categoryLabel(underweight.category)} is underweight by ${(underweight.diffPct).toFixed(1)}%. Deploy idle taxable cash first instead of selling appreciated positions elsewhere.`,
      amount,
      priority: 1_000_000 + amount,
      bucket: 'do_now',
      action: 'buy',
      taxImpact: 'none',
      tags: [`Best home: ${formatAccountLabel(bestAccount)}`],
    });
    taxableCashAllocated.set(underweight.category, (taxableCashAllocated.get(underweight.category) || 0) + amount);
    remainingTaxableCash -= amount;
  }

  const taxableLosers = holdings
    .filter((holding) => holding.account === 'taxable' && holding.price < (holding.costBasis || holding.price))
    .map((holding) => ({
      holding,
      loss: ((holding.costBasis || holding.price) - holding.price) * holding.shares,
    }))
    .filter((item) => item.loss > 100)
    .sort((a, b) => b.loss - a.loss);

  for (const item of taxableLosers.slice(0, 5)) {
    pushRec({
      title: `Harvest loss in ${item.holding.ticker}`,
      summary: `Taxable loss available today. Harvest the loss and avoid repurchasing the same security in taxable, IRA, Roth, HSA, or a spouse account during the wash-sale window.`,
      amount: item.loss,
      priority: 900_000 + item.loss,
      bucket: 'do_now',
      action: 'harvest',
      taxImpact: 'low',
      tags: ['Actionable now', 'Watch wash sale'],
    });
  }

  for (const underweight of underweights) {
    const amountRemaining = Math.max(underweight.amount - (taxableCashAllocated.get(underweight.category) || 0), 0);
    if (amountRemaining < 500) continue;
    const preferredAccounts = TAX_LOCATION_RULES[underweight.category]?.ideal || ['taxable'];
    pushRec({
      title: `Direct new money to ${categoryLabel(underweight.category)}`,
      summary: `${categoryLabel(underweight.category)} is underweight by ${(underweight.diffPct).toFixed(1)}%. Favor ${preferredAccounts.map((account) => formatAccountLabel(account)).join(' -> ')} for new contributions and rebalancing.`,
      amount: amountRemaining,
      priority: 100_000 + amountRemaining,
      bucket: 'future',
      action: 'future',
      taxImpact: 'none',
      tags: ['Future contributions'],
    });
  }

  const appreciatedTaxableMisplacements = holdings
    .filter((holding) => holding.account === 'taxable')
    .map((holding) => {
      const normalizedAccount = normalizeAccountForTaxPlacement(holding.account) as 'roth' | 'ira' | 'taxable';
      const best = getBestTaxAccount(holding.category);
      const value = holding.shares * holding.price;
      const appreciated = holding.price > (holding.costBasis || holding.price);
      return { holding, normalizedAccount, best, value, appreciated };
    })
    .filter((item) => item.value > 500 && item.best !== item.normalizedAccount && item.appreciated)
    .sort((a, b) => {
      const aDrag = estimateAnnualTaxDragSaved(a.holding.category, 'taxable', a.best, a.value);
      const bDrag = estimateAnnualTaxDragSaved(b.holding.category, 'taxable', b.best, b.value);
      return bDrag - aDrag;
    });

  for (const item of appreciatedTaxableMisplacements.slice(0, 4)) {
    const annualTaxDragSaved = estimateAnnualTaxDragSaved(item.holding.category, 'taxable', item.best, item.value);
    pushRec({
      title: `Do not sell ${item.holding.ticker} just to relocate it`,
      summary: `${item.holding.ticker} is in taxable even though ${formatAccountLabel(item.best)} is better. Because the position is appreciated, prioritize IRA/Roth swaps and new contributions before realizing gains here.`,
      amount: item.value,
      priority: 10_000 + annualTaxDragSaved,
      bucket: 'future',
      action: 'warning',
      taxImpact: 'taxable_gain',
      estimatedAnnualTaxDragSaved: annualTaxDragSaved,
      tags: ['Would trigger taxable gains'],
    });
  }

  recommendations.sort((a, b) => b.priority - a.priority);
  return recommendations;
}
