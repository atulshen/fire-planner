import type { CategoryKey, CategoryInfo, AccountType } from '../types';

export const CATEGORIES: Record<CategoryKey, CategoryInfo> = {
  us_stock:   { label: 'US Stocks',     color: '#3b82f6' },
  intl_stock: { label: 'Intl Stocks',   color: '#a855f7' },
  bond:       { label: 'Bonds',         color: '#22c55e' },
  muni:       { label: 'Munis',         color: '#2dd4bf' },
  reit:       { label: 'REITs',         color: '#f97316' },
  cash:       { label: 'Cash',          color: '#eab308' },
  crypto:     { label: 'Crypto',        color: '#ef4444' },
  other:      { label: 'Other',         color: '#9294a0' },
};

export const ACCOUNT_LABELS: Record<AccountType, string> = {
  roth: 'Roth IRA',
  hsa: 'HSA',
  ira: 'Traditional IRA',
  taxable: 'Taxable',
};

export const ACCOUNT_SHORT_LABELS: Record<AccountType, string> = {
  roth: 'ROTH',
  hsa: 'HSA',
  ira: 'IRA',
  taxable: 'TAX',
};

export const ACCOUNT_COLORS: Record<AccountType, string> = {
  roth: '#3b82f6',
  hsa: '#14b8a6',
  ira: '#a855f7',
  taxable: '#f97316',
};

export const DEFAULT_TARGETS: Record<CategoryKey, number> = {
  us_stock: 50, intl_stock: 20, bond: 15, muni: 5, reit: 5, cash: 5, crypto: 0, other: 0,
};
