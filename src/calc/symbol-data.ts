import type { CategoryKey, CompositeSplit } from '../types';
import { COMPOSITE_FUNDS } from '../constants/tickers';

export interface SymbolLookupResult {
  yield: number | null;
  price: number | null;
  name: string | null;
  allocation: CompositeSplit | null;
  assetClass?: string | null;
  etfCategory?: string | null;
  detectedCategory?: CategoryKey | null;
  expenseRatio?: number | null;
  sources?: string[];
}

export interface DealchartsSearchResult {
  key?: string;
  nameShort?: string;
  nameLong?: string;
  assetClass?: string;
  sector?: string;
  facts_url?: string;
}

export interface DealchartsHolding {
  value_usd?: number;
  pct_val?: number;
  asset_cat?: string;
  inv_country?: string;
  title?: string;
  issuer_name?: string;
  issuer_cat?: string;
}

export interface DealchartsFundFacts {
  name?: string;
  holdings?: DealchartsHolding[];
  summary?: {
    total_value_usd?: number;
    by_asset_category?: Record<string, { total_value_usd?: number }>;
  };
}

export interface EodhdEodBar {
  date?: string;
  close?: number | string;
  adjusted_close?: number | string;
  Close?: number | string;
  Adjusted_close?: number | string;
}

export function emptySymbolLookupResult(): SymbolLookupResult {
  return {
    yield: null,
    price: null,
    name: null,
    allocation: null,
    assetClass: null,
    etfCategory: null,
    detectedCategory: null,
    expenseRatio: null,
    sources: [],
  };
}

function parsePercent(value: unknown): number | null {
  if (value == null) return null;
  const match = String(value).match(/([\d.]+)/);
  return match ? parseFloat(match[1]) : null;
}

function parseNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const cleaned = String(value).replace(/[$,%\s,]/g, '');
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeAllocation(split: Record<string, number> | null): CompositeSplit | null {
  if (!split) return null;
  const positiveEntries = Object.entries(split).filter(([, value]) => value > 0);
  const total = positiveEntries.reduce((sum, [, value]) => sum + value, 0);
  if (total <= 0) return null;
  return positiveEntries.reduce((acc, [key, value]) => {
    acc[key] = value / total;
    return acc;
  }, {} as CompositeSplit);
}

function inferAllocationFromFundLabel(assetClass: string | null, etfCategory: string | null): CompositeSplit | null {
  if (assetClass !== 'Asset Allocation' || !etfCategory) return null;
  const cat = etfCategory.toLowerCase();
  if (cat.includes('aggressive') || cat.includes('85') || cat.includes('80')) return { us_stock: 0.48, intl_stock: 0.32, bond: 0.16, cash: 0.04 };
  if (cat.includes('growth') || cat.includes('60')) return { us_stock: 0.36, intl_stock: 0.24, bond: 0.32, cash: 0.08 };
  if (cat.includes('moderate') || cat.includes('50') || cat.includes('balanced')) return { us_stock: 0.30, intl_stock: 0.20, bond: 0.35, cash: 0.15 };
  if (cat.includes('conservative') || cat.includes('30') || cat.includes('40')) return { us_stock: 0.24, intl_stock: 0.16, bond: 0.42, cash: 0.18 };
  if (cat.includes('income') || cat.includes('20')) return { us_stock: 0.12, intl_stock: 0.08, bond: 0.56, cash: 0.24 };
  return null;
}

function detectCategory(assetClass: string | null, etfCategory: string | null): CategoryKey | null {
  if (assetClass === 'Fixed Income') return 'bond';
  if (assetClass === 'Equity') {
    return etfCategory && /international|foreign|emerging|global/i.test(etfCategory)
      ? 'intl_stock'
      : 'us_stock';
  }
  if (assetClass === 'Real Estate') return 'reit';
  return null;
}

export function parseStockAnalysisOverview(ticker: string, data: any): SymbolLookupResult | null {
  if (!data) return null;

  let yld: number | null = null;
  if (data.dividendYield != null) yld = parseFloat(data.dividendYield);
  else if (data.dividend) {
    const match = String(data.dividend).match(/([\d.]+)%/);
    if (match) yld = parseFloat(match[1]);
  }

  let price: number | null = null;
  if (data.nav != null) price = parseFloat(String(data.nav).replace(/[$,]/g, ''));
  else if (data.price != null) price = parseFloat(String(data.price).replace(/[$,]/g, ''));

  let name: string | null = null;
  if (data.name) name = data.name;
  else if (data.description) {
    const firstSentence = String(data.description).split(/\.\s/)[0];
    const nameMatch = firstSentence.match(/^(.+?)(?:\s+is\s|\s+designs\s|\s+provides\s|\s+develops\s|\s+operates\s|\s+manufactures\s)/i);
    name = nameMatch ? nameMatch[1] : firstSentence.substring(0, 50);
  }

  let assetClass: string | null = null;
  let etfCategory: string | null = null;
  let expenseRatio: number | null = parsePercent(data.expenseRatio ?? data.expense_ratio ?? data.netExpenseRatio ?? data.net_expense_ratio);
  const infoTable = data.infoTable;
  if (Array.isArray(infoTable)) {
    for (const item of infoTable) {
      if (!Array.isArray(item)) continue;
      const label = String(item[0] || '');
      const normalizedLabel = label.toLowerCase();
      if (label === 'Asset Class') assetClass = item[1];
      if (label === 'Category') etfCategory = item[1];
      if (item[1] && normalizedLabel.includes('expense') && normalizedLabel.includes('ratio')) {
        expenseRatio = parsePercent(item[1]) ?? expenseRatio;
      }
    }
  }

  const allocation = COMPOSITE_FUNDS[ticker.toUpperCase()] || inferAllocationFromFundLabel(assetClass, etfCategory);
  return {
    yield: yld,
    price,
    name,
    allocation,
    assetClass,
    etfCategory,
    detectedCategory: detectCategory(assetClass, etfCategory),
    expenseRatio,
    sources: ['Stock Analysis overview'],
  };
}

export function parseEodhdEodPrice(
  payload: EodhdEodBar | EodhdEodBar[] | null | undefined,
  source = 'EODHD end-of-day price',
): SymbolLookupResult | null {
  if (!payload) return null;
  const series = Array.isArray(payload) ? payload : [payload];
  const lastBar = series.filter(Boolean).at(-1);
  const price = parseNumber(lastBar?.adjusted_close ?? lastBar?.close ?? lastBar?.Adjusted_close ?? lastBar?.Close);
  if (price == null) return null;
  return {
    yield: null,
    price,
    name: null,
    allocation: null,
    assetClass: null,
    etfCategory: null,
    detectedCategory: null,
    expenseRatio: null,
    sources: [source],
  };
}

export function mergeSymbolLookupResults(...parts: Array<SymbolLookupResult | null | undefined>): SymbolLookupResult {
  const merged = emptySymbolLookupResult();
  for (const part of parts) {
    if (!part) continue;
    if (part.yield != null) merged.yield = part.yield;
    if (part.price != null) merged.price = part.price;
    if (part.name) merged.name = part.name;
    if (part.allocation) merged.allocation = part.allocation;
    if (part.assetClass) merged.assetClass = part.assetClass;
    if (part.etfCategory) merged.etfCategory = part.etfCategory;
    if (part.detectedCategory) merged.detectedCategory = part.detectedCategory;
    if (part.expenseRatio != null) merged.expenseRatio = part.expenseRatio;
    if (part.sources?.length) {
      merged.sources = [...new Set([...(merged.sources || []), ...part.sources])];
    }
  }
  return merged;
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((token) => token.length >= 3);
}

export function buildDealchartsQueries(ticker: string, name?: string | null): string[] {
  const queries = new Set<string>([ticker.toUpperCase()]);
  const trimmedName = name?.trim();
  if (trimmedName) {
    queries.add(trimmedName);
    if (!/\bfund\b/i.test(trimmedName)) queries.add(`${trimmedName} fund`);
  }
  return [...queries];
}

function scoreDealchartsResult(result: DealchartsSearchResult, ticker: string, name?: string | null): number {
  const resultName = `${result.nameLong || ''} ${result.nameShort || ''}`.trim().toLowerCase();
  const resultKey = (result.key || '').toLowerCase();
  const resultTokens = new Set(tokenize(`${resultName} ${resultKey}`));
  const targetTokens = new Set(tokenize(`${ticker} ${name || ''}`));
  let score = 0;
  for (const token of targetTokens) {
    if (resultTokens.has(token)) score += 1;
  }
  if ((result.assetClass || '').toLowerCase() === 'fund' || (result.sector || '').toLowerCase() === 'fund') score += 1;
  if (name && resultName.includes(name.toLowerCase())) score += 2;
  return score;
}

export function pickDealchartsSearchResult(
  results: DealchartsSearchResult[],
  ticker: string,
  name?: string | null,
): DealchartsSearchResult | null {
  if (!results.length) return null;
  return [...results]
    .filter((result) => !!result.facts_url)
    .sort((left, right) => scoreDealchartsResult(right, ticker, name) - scoreDealchartsResult(left, ticker, name))[0] || null;
}

function isLikelyMunicipalDebt(name: string, holding?: DealchartsHolding): boolean {
  const haystack = `${name} ${holding?.title || ''} ${holding?.issuer_name || ''} ${holding?.issuer_cat || ''}`.toLowerCase();
  return /\bmuni|municipal|tax[- ]exempt|tax[- ]managed\b/.test(haystack);
}

function classifyHolding(name: string, holding: DealchartsHolding): CategoryKey | null {
  const assetCat = (holding.asset_cat || '').toUpperCase();
  const label = `${holding.title || ''} ${holding.issuer_name || ''} ${holding.issuer_cat || ''}`.toLowerCase();

  if (/cash|money market|repurchase|treasury liquidity|settlement/.test(label)) return 'cash';
  if (/reit|real estate/.test(label)) return 'reit';
  if (assetCat === 'EC') return holding.inv_country && holding.inv_country !== 'US' ? 'intl_stock' : 'us_stock';
  if (assetCat === 'DBT' || assetCat === 'ABS-MBS') return isLikelyMunicipalDebt(name, holding) ? 'muni' : 'bond';
  return null;
}

function allocationFromHoldings(name: string, holdings: DealchartsHolding[]): CompositeSplit | null {
  const totals: Record<string, number> = {};
  let total = 0;

  for (const holding of holdings) {
    const category = classifyHolding(name, holding);
    if (!category) continue;
    const amount = holding.value_usd && holding.value_usd > 0 ? holding.value_usd : null;
    if (amount == null) continue;
    totals[category] = (totals[category] || 0) + amount;
    total += amount;
  }

  if (total <= 0) return null;
  return normalizeAllocation(totals);
}

function allocationFromSummary(name: string, facts: DealchartsFundFacts): CompositeSplit | null {
  const byAssetCategory = facts.summary?.by_asset_category;
  const total = facts.summary?.total_value_usd || 0;
  if (!byAssetCategory || total <= 0) return null;

  const equities = (byAssetCategory.EC?.total_value_usd || 0);
  const debt = (byAssetCategory.DBT?.total_value_usd || 0) + (byAssetCategory['ABS-MBS']?.total_value_usd || 0);
  const split: Record<string, number> = {};

  if (equities > 0) {
    if (/international|foreign|global|world|emerging|ex[- ]?us/.test(name.toLowerCase())) split.intl_stock = equities;
    else split.us_stock = equities;
  }
  if (debt > 0) {
    split[isLikelyMunicipalDebt(name) ? 'muni' : 'bond'] = debt;
  }
  return normalizeAllocation(split);
}

export function parseDealchartsFundFacts(ticker: string, facts: DealchartsFundFacts): SymbolLookupResult | null {
  const name = facts.name || null;
  const allocation = COMPOSITE_FUNDS[ticker.toUpperCase()]
    || allocationFromHoldings(name || '', facts.holdings || [])
    || allocationFromSummary(name || '', facts);

  let assetClass: string | null = null;
  if (allocation) {
    const keys = Object.keys(allocation);
    assetClass = keys.length > 1 ? 'Multi-Asset Fund' : keys[0] || null;
  }

  let detectedCategory: CategoryKey | null = null;
  if (!allocation && name) {
    if (/municipal|muni|tax[- ]exempt/.test(name.toLowerCase())) detectedCategory = 'muni';
    else if (/bond|fixed income|income/.test(name.toLowerCase())) detectedCategory = 'bond';
    else if (/international|global|world|foreign|emerging/.test(name.toLowerCase())) detectedCategory = 'intl_stock';
    else detectedCategory = 'us_stock';
  }

  return {
    yield: null,
    price: null,
    name,
    allocation,
    assetClass,
    etfCategory: null,
    detectedCategory,
    expenseRatio: null,
    sources: ['Dealcharts fund facts'],
  };
}

export function inferCategoryFromTickerAndName(ticker: string, name?: string | null): CategoryKey | null {
  const t = ticker.toUpperCase();
  const n = (name || '').toLowerCase();

  if (/money market|settlement|cash|treasury money market/.test(n)) return 'cash';
  if (/municipal|muni|tax[- ]exempt/.test(n)) return 'muni';
  if (/bond|fixed income|treasury|income/.test(n)) return 'bond';
  if (/reit|real estate/.test(n)) return 'reit';
  if (/international|foreign|emerging|ex[- ]?us|total intl|total international|global ex us/.test(n)) return 'intl_stock';
  if (/stock|equity|index/.test(n)) return 'us_stock';
  if (/^[A-Z]{5}X$/.test(t)) return 'us_stock';
  return null;
}

export function hasSymbolLookupData(data: SymbolLookupResult | null | undefined): boolean {
  if (!data) return false;
  return Boolean(
    data.yield != null
      || data.price != null
      || data.name
      || data.allocation
      || data.assetClass
      || data.etfCategory
      || data.detectedCategory
      || data.expenseRatio != null,
  );
}

export function isLikelyFundTicker(ticker: string, name?: string | null): boolean {
  if (COMPOSITE_FUNDS[ticker.toUpperCase()]) return true;
  if (/^[A-Z]{5}X$/.test(ticker.toUpperCase())) return true;
  if (!name) return false;
  return /\bfund\b|balanced|allocation|lifestrategy|target|income|index/i.test(name);
}
