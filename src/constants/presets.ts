export interface PresetColumnMap {
  ticker: string;
  name: string;
  shares: string;
  price: string;
  costBasis: string | null;
  costTotal: string | null;
  value: string;
  account: string | null;
}

export interface Preset {
  label: string;
  map: PresetColumnMap;
}

export const PRESETS: Record<string, Preset> = {
  fidelity: {
    label: 'Fidelity',
    map: {
      ticker: 'Symbol', name: 'Description', shares: 'Quantity',
      price: 'Last Price', costBasis: null, costTotal: 'Cost Basis Total',
      value: 'Current Value', account: 'Account Number'
    }
  },
  schwab: {
    label: 'Schwab',
    map: {
      ticker: 'Symbol', name: 'Description', shares: 'Quantity',
      price: 'Price', costBasis: 'Cost Basis', costTotal: null,
      value: 'Market Value', account: null
    }
  },
  vanguard: {
    label: 'Vanguard',
    map: {
      ticker: 'Symbol', name: 'Investment Name', shares: 'Shares',
      price: 'Share Price', costBasis: null, costTotal: 'Total Cost',
      value: 'Total Value', account: 'Account Number'
    }
  },
  etrade: {
    label: 'E*TRADE',
    map: {
      ticker: 'Symbol', name: 'Description', shares: 'Quantity',
      price: 'Last Price $', costBasis: null, costTotal: 'Cost Basis',
      value: 'Value $', account: null
    }
  },
  generic: {
    label: 'Generic',
    map: {
      ticker: 'Symbol', name: 'Name', shares: 'Shares',
      price: 'Price', costBasis: 'Cost Basis', costTotal: null,
      value: 'Value', account: 'Account'
    }
  }
};
