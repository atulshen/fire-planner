import type { CategoryKey, AccountType } from '../types';
import {
  INTL_TICKERS, BOND_TICKERS, MUNI_TICKERS, REIT_TICKERS,
  CASH_TICKERS, CRYPTO_TICKERS, COMPOSITE_FUNDS,
} from '../constants/tickers';

/**
 * Guess the asset category from ticker symbol and fund name.
 */
export function guessCategory(ticker: string, name?: string): CategoryKey {
  const t = ticker.toUpperCase();
  const n = (name || '').toLowerCase();

  // Composite/balanced funds — tagged as 'other', allocation handled by split logic
  if (COMPOSITE_FUNDS[t] || n.includes('target') || n.includes('lifecycle') || n.includes('balanced')
      || n.includes('lifestrategy') || n.includes('freedom') || n.includes('allocation')) return 'other';
  if (CASH_TICKERS.has(t) || n.includes('money market') || n.includes('cash') || n.includes('settlement')) return 'cash';
  if (CRYPTO_TICKERS.has(t) || n.includes('bitcoin') || n.includes('crypto') || n.includes('ethereum')) return 'crypto';
  if (MUNI_TICKERS.has(t) || n.includes('municipal') || n.includes('muni') || n.includes('tax-exempt') || n.includes('tax exempt')) return 'muni';
  if (BOND_TICKERS.has(t) || n.includes('bond') || n.includes('fixed income') || n.includes('treasury') || n.includes('aggregate')) return 'bond';
  if (REIT_TICKERS.has(t) || n.includes('real estate') || n.includes('reit')) return 'reit';
  if (INTL_TICKERS.has(t) || n.includes('international') || n.includes('intl') || n.includes('emerging') || n.includes('foreign') || n.includes('ex-us')) return 'intl_stock';
  return 'us_stock';
}

/**
 * Guess account type from account description string (e.g. "Roth IRA", "Traditional IRA").
 */
export function guessAccountType(acctStr: string): AccountType {
  const s = (acctStr || '').toLowerCase();
  const normalized = s.replace(/[^a-z0-9]+/g, ' ');
  if (s.includes('roth')) return 'roth';
  if (s.includes('hsa') || normalized.includes('health savings')) return 'hsa';
  if (s.includes('traditional') || s.includes('trad') || s.includes('ira') || s.includes('rollover')) return 'ira';
  return 'taxable';
}
