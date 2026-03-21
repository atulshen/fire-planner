import type { AccountType, CategoryKey, Holding, YieldCache } from '../types';
import { CATEGORY_TOTAL_RETURNS } from '../constants/returns';
import { TAX_LOCATION_RULES } from '../constants/tax';
import { CATEGORY_YIELDS } from '../constants/yields';
import { getEffectiveAllocation } from './allocation';

export type RebalanceAccount = 'taxable' | 'ira' | 'roth';
export type AccountCategoryBalances = Record<RebalanceAccount, Record<CategoryKey, number>>;

const CATEGORY_KEYS: CategoryKey[] = ['us_stock', 'intl_stock', 'bond', 'muni', 'reit', 'cash', 'crypto', 'other'];
const INVESTED_CATEGORY_KEYS: CategoryKey[] = CATEGORY_KEYS.filter((category) => category !== 'cash');
const REBALANCE_ACCOUNTS: RebalanceAccount[] = ['taxable', 'ira', 'roth'];

function emptyCategoryBalances(): Record<CategoryKey, number> {
  return {
    us_stock: 0,
    intl_stock: 0,
    bond: 0,
    muni: 0,
    reit: 0,
    cash: 0,
    crypto: 0,
    other: 0,
  };
}

export function createEmptyAccountCategoryBalances(): AccountCategoryBalances {
  return {
    taxable: emptyCategoryBalances(),
    ira: emptyCategoryBalances(),
    roth: emptyCategoryBalances(),
  };
}

function normalizeAccount(account: AccountType): RebalanceAccount {
  return account === 'hsa' ? 'roth' : account;
}

function getPreferredAccounts(category: CategoryKey): RebalanceAccount[] {
  const preferred = TAX_LOCATION_RULES[category]?.ideal || ['taxable', 'ira', 'roth'];
  const seen = new Set<RebalanceAccount>();
  const normalized: RebalanceAccount[] = [];
  for (const account of preferred) {
    const next = normalizeAccount(account);
    if (!seen.has(next)) {
      normalized.push(next);
      seen.add(next);
    }
  }
  for (const account of REBALANCE_ACCOUNTS) {
    if (!seen.has(account)) normalized.push(account);
  }
  return normalized;
}

export function getAccountBalance(
  accountBalances: AccountCategoryBalances,
  account: RebalanceAccount,
): number {
  return CATEGORY_KEYS.reduce((sum, category) => sum + accountBalances[account][category], 0);
}

export function deriveInvestedTargetMix(
  holdings: Holding[],
  yieldCache?: YieldCache,
): Record<CategoryKey, number> {
  const byCategory = emptyCategoryBalances();
  let totalInvested = 0;

  for (const holding of holdings) {
    const allocation = getEffectiveAllocation(holding, yieldCache);
    for (const [rawCategory, amount] of Object.entries(allocation) as Array<[CategoryKey, number]>) {
      if (rawCategory === 'cash' || amount <= 0) continue;
      byCategory[rawCategory] += amount;
      totalInvested += amount;
    }
  }

  if (totalInvested <= 0) return byCategory;

  for (const category of INVESTED_CATEGORY_KEYS) {
    byCategory[category] /= totalInvested;
  }
  byCategory.cash = 0;
  return byCategory;
}

export function rebalanceInvestedAccounts(
  accountTotals: Record<RebalanceAccount, number>,
  targetWeights: Record<CategoryKey, number>,
): AccountCategoryBalances {
  const rebalanced = createEmptyAccountCategoryBalances();
  const remainingCapacity: Record<RebalanceAccount, number> = {
    taxable: Math.max(accountTotals.taxable || 0, 0),
    ira: Math.max(accountTotals.ira || 0, 0),
    roth: Math.max(accountTotals.roth || 0, 0),
  };
  const totalInvested = remainingCapacity.taxable + remainingCapacity.ira + remainingCapacity.roth;
  if (totalInvested <= 0) return rebalanced;

  const categories = INVESTED_CATEGORY_KEYS
    .map((category) => ({
      category,
      amount: totalInvested * Math.max(targetWeights[category] || 0, 0),
      preferredAccounts: getPreferredAccounts(category),
    }))
    .filter((item) => item.amount > 0)
    .sort((left, right) => {
      const prefDiff = left.preferredAccounts.length - right.preferredAccounts.length;
      if (prefDiff !== 0) return prefDiff;
      return right.amount - left.amount;
    });

  for (const item of categories) {
    let remaining = item.amount;
    for (const account of item.preferredAccounts) {
      if (remaining <= 0) break;
      const allocation = Math.min(remaining, remainingCapacity[account]);
      if (allocation <= 0) continue;
      rebalanced[account][item.category] += allocation;
      remainingCapacity[account] -= allocation;
      remaining -= allocation;
    }
  }

  const residualCapacity = REBALANCE_ACCOUNTS.reduce((sum, account) => sum + remainingCapacity[account], 0);
  if (residualCapacity > 0.01) {
    const fallbackCategory = categories[0]?.category || 'other';
    for (const account of REBALANCE_ACCOUNTS) {
      if (remainingCapacity[account] <= 0) continue;
      rebalanced[account][fallbackCategory] += remainingCapacity[account];
      remainingCapacity[account] = 0;
    }
  }

  return rebalanced;
}

export function estimateAccountReturnFromBalances(
  accountBalances: AccountCategoryBalances,
  account: RebalanceAccount,
): number {
  const total = getAccountBalance(accountBalances, account);
  if (total <= 0) return 0;

  return CATEGORY_KEYS.reduce((sum, category) => {
    const amount = accountBalances[account][category];
    if (amount <= 0) return sum;
    return sum + amount * (CATEGORY_TOTAL_RETURNS[category] || CATEGORY_TOTAL_RETURNS.other);
  }, 0) / total;
}

export function estimateAccountYieldFromBalances(
  accountBalances: AccountCategoryBalances,
  account: RebalanceAccount,
): number {
  const total = getAccountBalance(accountBalances, account);
  if (total <= 0) return 0;

  return CATEGORY_KEYS.reduce((sum, category) => {
    const amount = accountBalances[account][category];
    if (amount <= 0) return sum;
    return sum + amount * (CATEGORY_YIELDS[category] || CATEGORY_YIELDS.other);
  }, 0) / total;
}

export function growRebalancedAccounts(
  accountBalances: AccountCategoryBalances,
): AccountCategoryBalances {
  const grown = createEmptyAccountCategoryBalances();
  for (const account of REBALANCE_ACCOUNTS) {
    for (const category of CATEGORY_KEYS) {
      const amount = accountBalances[account][category];
      grown[account][category] = amount * (1 + ((CATEGORY_TOTAL_RETURNS[category] || CATEGORY_TOTAL_RETURNS.other) / 100));
    }
  }
  return grown;
}
