import type { TaxBracket, TaxLocationRule, AccountType, CategoryKey } from '../types';
import { PLANNING_BASE_YEAR } from './planning';

// 2026 planning baseline tax brackets (single filer)
export const ORDINARY_TAX_BRACKETS_BASELINE: TaxBracket[] = [
  { min: 0, max: 12400, rate: 0.10 },
  { min: 12400, max: 50400, rate: 0.12 },
  { min: 50400, max: 105700, rate: 0.22 },
  { min: 105700, max: 201775, rate: 0.24 },
  { min: 201775, max: 256225, rate: 0.32 },
  { min: 256225, max: 640600, rate: 0.35 },
  { min: 640600, max: Infinity, rate: 0.37 },
];

export const STANDARD_DEDUCTION_BASELINE = 16100; // 2026 single
export const SOCIAL_SECURITY_WAGE_BASE_BASELINE = 184500;
export const SOCIAL_SECURITY_PAYROLL_RATE = 0.062;
export const MEDICARE_PAYROLL_RATE = 0.0145;
export const ADDITIONAL_MEDICARE_RATE = 0.009;
export const ADDITIONAL_MEDICARE_THRESHOLD_SINGLE = 200000;

// 2026 planning baseline long-term capital gains brackets (single filer), taxable income basis
export const LTCG_TAX_BRACKETS_BASELINE: TaxBracket[] = [
  { min: 0, max: 49450, rate: 0.00 },
  { min: 49450, max: 545500, rate: 0.15 },
  { min: 545500, max: Infinity, rate: 0.20 },
];

export const TAX_PLANNING_BASELINE_LABEL = `${PLANNING_BASE_YEAR} planning baseline`;

// RMD distribution periods by age (from IRS Uniform Lifetime Table)
export const RMD_TABLE: Record<number, number> = {
  73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9,
  78: 22.0, 79: 21.1, 80: 20.2, 81: 19.4, 82: 18.5,
  83: 17.7, 84: 16.8, 85: 16.0, 86: 15.2, 87: 14.4,
  88: 13.7, 89: 12.9, 90: 12.2, 91: 11.5, 92: 10.8,
  93: 10.1, 94: 9.5, 95: 8.9, 96: 8.4, 97: 7.8,
  98: 7.3, 99: 6.8, 100: 6.4,
};

export const TAX_LOCATION_RULES: Record<CategoryKey, TaxLocationRule> = {
  bond: {
    ideal: ['ira', 'roth', 'taxable'] as AccountType[],
    label: 'Bonds',
    reason: 'Bond interest is taxed as ordinary income — best sheltered in tax-deferred accounts',
  },
  reit: {
    ideal: ['ira', 'roth', 'taxable'] as AccountType[],
    label: 'REITs',
    reason: 'REIT dividends are non-qualified and taxed as ordinary income — shelter in tax-deferred',
  },
  intl_stock: {
    ideal: ['taxable', 'roth', 'ira'] as AccountType[],
    label: 'International Stocks',
    reason: 'Foreign tax credit is only usable in taxable accounts — holding in tax-advantaged wastes the credit',
  },
  us_stock: {
    ideal: ['roth', 'taxable', 'ira'] as AccountType[],
    label: 'US Stocks',
    reason: 'High long-term growth is best in Roth (tax-free gains) or taxable (favorable LTCG rates)',
  },
  cash: {
    ideal: ['ira', 'roth', 'taxable'] as AccountType[],
    label: 'Cash / Money Market',
    reason: 'Money market interest is ordinary income — shelter it from taxes when possible',
  },
  crypto: {
    ideal: ['roth', 'ira', 'taxable'] as AccountType[],
    label: 'Crypto',
    reason: 'Highest growth potential benefits most from Roth tax-free treatment',
  },
  muni: {
    ideal: ['taxable', 'taxable', 'taxable'] as AccountType[],
    label: 'Municipal Bonds',
    reason: 'Muni interest is already federal tax-exempt — their tax benefit is wasted inside tax-advantaged accounts',
  },
  other: {
    ideal: ['roth', 'ira', 'taxable'] as AccountType[],
    label: 'Other',
    reason: 'Default: prefer tax-advantaged accounts',
  },
};
