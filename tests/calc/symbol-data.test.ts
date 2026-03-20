import { describe, expect, it } from 'vitest';
import {
  buildDealchartsQueries,
  hasSymbolLookupData,
  parseEodhdEodPrice,
  parseDealchartsFundFacts,
  parseStockAnalysisOverview,
  pickDealchartsSearchResult,
} from '../../src/calc/symbol-data';

describe('parseStockAnalysisOverview', () => {
  it('infers balanced-fund allocation from asset allocation labels', () => {
    const parsed = parseStockAnalysisOverview('TESTX', {
      name: 'Balanced Test Fund',
      dividendYield: '2.1',
      nav: '$15.25',
      infoTable: [
        ['Asset Class', 'Asset Allocation'],
        ['Category', 'Moderate Allocation'],
        ['Net Expense Ratio', '0.18%'],
      ],
    });

    expect(parsed).not.toBeNull();
    expect(parsed?.yield).toBe(2.1);
    expect(parsed?.price).toBe(15.25);
    expect(parsed?.expenseRatio).toBe(0.18);
    expect(parsed?.allocation).toEqual({
      us_stock: 0.30,
      intl_stock: 0.20,
      bond: 0.35,
      cash: 0.15,
    });
  });
});

describe('Dealcharts helpers', () => {
  it('builds useful search queries for mutual funds', () => {
    expect(buildDealchartsQueries('VTMFX', 'Vanguard Tax-Managed Balanced')).toEqual([
      'VTMFX',
      'Vanguard Tax-Managed Balanced',
      'Vanguard Tax-Managed Balanced fund',
    ]);
  });

  it('picks the best matching search result', () => {
    const result = pickDealchartsSearchResult([
      { key: 'random-fund', nameLong: 'Random Income Fund', facts_url: 'https://example.com/a.json' },
      { key: 'vanguard-tax-managed-balanced-fund', nameLong: 'VANGUARD TAX-MANAGED BALANCED FUND', facts_url: 'https://example.com/b.json' },
    ], 'VTMFX', 'Vanguard Tax-Managed Balanced');

    expect(result?.facts_url).toBe('https://example.com/b.json');
  });

  it('derives a blended mutual-fund allocation from holdings facts', () => {
    const parsed = parseDealchartsFundFacts('ABCDX', {
      name: 'Balanced Municipal Fund',
      holdings: [
        { asset_cat: 'EC', inv_country: 'US', value_usd: 500 },
        { asset_cat: 'DBT', issuer_cat: 'MUNI', value_usd: 500 },
      ],
    });

    expect(parsed?.allocation).toEqual({
      us_stock: 0.5,
      muni: 0.5,
    });
    expect(parsed?.name).toBe('Balanced Municipal Fund');
    expect(hasSymbolLookupData(parsed)).toBe(true);
  });

  it('falls back to asset-category summary when holdings are absent', () => {
    const parsed = parseDealchartsFundFacts('WORLDX', {
      name: 'Global Allocation Fund',
      summary: {
        total_value_usd: 1000,
        by_asset_category: {
          EC: { total_value_usd: 600 },
          DBT: { total_value_usd: 400 },
        },
      },
    });

    expect(parsed?.allocation).toEqual({
      intl_stock: 0.6,
      bond: 0.4,
    });
  });
});

describe('EODHD helpers', () => {
  it('parses end-of-day payloads', () => {
    const parsed = parseEodhdEodPrice([
      { date: '2026-03-18', adjusted_close: '49.85' },
      { date: '2026-03-19', adjusted_close: '50.12' },
    ]);

    expect(parsed?.price).toBe(50.12);
    expect(parsed?.sources).toEqual(['EODHD end-of-day price']);
  });
});
