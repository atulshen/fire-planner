export type CategoryKey = 'us_stock' | 'intl_stock' | 'bond' | 'muni' | 'reit' | 'cash' | 'crypto' | 'other';
export type AccountType = 'roth' | 'hsa' | 'ira' | 'taxable';

export interface Holding {
  ticker: string;
  name: string;
  account: AccountType;
  brokerage?: string;
  category: CategoryKey;
  shares: number;
  costBasis: number;
  price: number;
  dividendYield: number;
  accountNumber?: string;
}

export interface CategoryInfo {
  label: string;
  color: string;
}

export interface TaxLocationRule {
  ideal: AccountType[];
  label: string;
  reason: string;
}

export interface BrokeragePreset {
  label: string;
  map: {
    ticker: string;
    name: string;
    shares: string;
    price: string;
    costBasis: string | null;
    costTotal: string | null;
    value: string;
    account: string | null;
  };
}

export interface CompositeSplit {
  [key: string]: number; // category key -> percentage
}

export interface TaxBracket {
  min: number;
  max: number;
  rate: number;
}

export interface TaxResult {
  tax: number;
  effectiveRate: number;
}

export interface AcaResult {
  eligible: boolean;
  reason?: string;
  subsidy: number;
  goldPremium: number;
  netPremium: number;
  benchmark: number;
  fplRatio: number;
}

export interface DrawdownParams {
  currentAge: number;
  retireAge: number;
  expenses: number;
  inflation: number;
  returnRate: number;
  taxRate: number;
  ltcgRate: number;
  ssIncome: number;
}

export interface DrawdownYear {
  age: number;
  rothBal: number;
  iraBal: number;
  taxableBal: number;
  totalBalance: number;
  withdrawal: number;
  taxPaid: number;
  ssIncome: number;
  expenses: number;
}

export interface DrawdownResult {
  years: DrawdownYear[];
  totalTaxPaid: number;
  depletionAge: number | null;
  finalBalance: number;
  totalWithdrawn: number;
}

export interface ConversionParams {
  startAge: number;
  lifeExp: number;
  baseIncome: number;
  annualSpending: number;
  iraBalance: number;
  taxableBalance: number;
  rothBalance: number;
  growth: number;
  ssIncome: number;
  strategy: string;
}

export interface ConversionResult {
  totalSpent: number;
  totalTaxPaid: number;
  totalSubsidyReceived: number;
  finalRoth: number;
  finalIra: number;
  finalTaxable: number;
  years: ConversionYear[];
}

export interface ConversionYear {
  age: number;
  conversion: number;
  tax: number;
  subsidy: number;
  spending: number;
  iraBal: number;
  rothBal: number;
  taxableBal: number;
}

export interface TaxEfficiencyResult {
  ticker: string;
  name: string;
  category: CategoryKey;
  account: AccountType;
  value: number;
  score: number;
  status: 'ok' | 'warn' | 'bad';
  idealAccount: AccountType;
  moveReason: string | null;
}

export interface TaxEfficiencyAnalysis {
  results: TaxEfficiencyResult[];
  moves: TaxEfficiencyMove[];
  overallScore: number;
  totalValue: number;
}

export interface TaxEfficiencyMove {
  ticker: string;
  category: CategoryKey;
  from: AccountType;
  to: AccountType;
  value: number;
  reason: string;
  severity: number;
}

export interface YieldCacheEntry {
  yield: number;
  price: number;
  name: string;
  allocation: CompositeSplit | null;
  assetClass?: string;
  etfCategory?: string;
  detectedCategory?: CategoryKey;
  expenseRatio?: number;
  fetched: number;
}

export type YieldCache = Record<string, YieldCacheEntry>;
