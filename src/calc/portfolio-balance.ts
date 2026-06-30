import type { Holding } from '../types';

export interface HoldingBalances {
  taxable: number;
  taxableBasis: number;
  taxableCash: number;
  taxableInvested: number;
  taxableInvestedBasis: number;
  ira: number;
  roth: number;
  hsa: number;
}

export interface PlannerFundingSource {
  holdingsNetWorth: number;
  otherAssetsAdjustment: number;
  liabilitiesAdjustment: number;
  startingNetWorth: number;
}

export interface PlannerPortfolioContext {
  totalNetWorth: number;
  taxableInvested: number;
  taxableCash: number;
  ira: number;
  rothHsa: number;
  investedAssets: number;
  cashLikeAssets: number;
}

export function getHoldingBalances(holdings: Holding[]): HoldingBalances {
  let taxable = 0;
  let taxableBasis = 0;
  let taxableCash = 0;
  let taxableInvested = 0;
  let taxableInvestedBasis = 0;
  let ira = 0;
  let roth = 0;
  let hsa = 0;

  for (const holding of holdings) {
    const value = holding.shares * holding.price;
    const cost = holding.shares * holding.costBasis;

    if (holding.account === 'taxable') {
      taxable += value;
      taxableBasis += cost;
      if (holding.category === 'cash') {
        taxableCash += value;
      } else {
        taxableInvested += value;
        taxableInvestedBasis += cost;
      }
    } else if (holding.account === 'ira') {
      ira += value;
    } else if (holding.account === 'roth') {
      roth += value;
    } else if (holding.account === 'hsa') {
      hsa += value;
    }
  }

  return { taxable, taxableBasis, taxableCash, taxableInvested, taxableInvestedBasis, ira, roth, hsa };
}

export function getPortfolioNetWorthFromBalances(balances: HoldingBalances): number {
  return balances.taxable + balances.ira + balances.roth + balances.hsa;
}

export function getPortfolioNetWorth(holdings: Holding[]): number {
  return getPortfolioNetWorthFromBalances(getHoldingBalances(holdings));
}

export function calculatePlannerFundingSource(
  holdings: Holding[],
  otherAssetsAdjustment = 0,
  liabilitiesAdjustment = 0,
): PlannerFundingSource {
  const holdingsNetWorth = getPortfolioNetWorth(holdings);
  const normalizedLiabilitiesAdjustment = Math.max(liabilitiesAdjustment, 0);
  return {
    holdingsNetWorth,
    otherAssetsAdjustment,
    liabilitiesAdjustment: normalizedLiabilitiesAdjustment,
    startingNetWorth: holdingsNetWorth + otherAssetsAdjustment - normalizedLiabilitiesAdjustment,
  };
}

export function getPlannerPortfolioContext(holdings: Holding[]): PlannerPortfolioContext {
  const balances = getHoldingBalances(holdings);
  const rothHsa = balances.roth + balances.hsa;
  const totalNetWorth = balances.taxable + balances.ira + rothHsa;
  const investedAssets = balances.taxableInvested + balances.ira + rothHsa;
  return {
    totalNetWorth,
    taxableInvested: balances.taxableInvested,
    taxableCash: balances.taxableCash,
    ira: balances.ira,
    rothHsa,
    investedAssets,
    cashLikeAssets: balances.taxableCash,
  };
}
