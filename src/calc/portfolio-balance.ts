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

export function resolvePlannerStartingNetWorth(holdings: Holding[], manualNetWorth: number): number {
  const holdingsNetWorth = getPortfolioNetWorth(holdings);
  return holdings.length > 0 && holdingsNetWorth > 0 ? holdingsNetWorth : manualNetWorth;
}
