import { describe, it, expect } from 'vitest';
import { guessCategory, guessAccountType } from '../../src/calc/category';

describe('guessCategory', () => {
  it('identifies US stock tickers', () => {
    expect(guessCategory('VTI')).toBe('us_stock');
    expect(guessCategory('AAPL')).toBe('us_stock');
    expect(guessCategory('MSFT')).toBe('us_stock');
  });

  it('identifies international stock tickers', () => {
    expect(guessCategory('VXUS')).toBe('intl_stock');
    expect(guessCategory('EFA')).toBe('intl_stock');
    expect(guessCategory('VWO')).toBe('intl_stock');
  });

  it('identifies bond tickers', () => {
    expect(guessCategory('BND')).toBe('bond');
    expect(guessCategory('AGG')).toBe('bond');
    expect(guessCategory('TLT')).toBe('bond');
  });

  it('identifies muni tickers', () => {
    expect(guessCategory('MUB')).toBe('muni');
    expect(guessCategory('VTEB')).toBe('muni');
  });

  it('identifies REIT tickers', () => {
    expect(guessCategory('VNQ')).toBe('reit');
    expect(guessCategory('SCHH')).toBe('reit');
  });

  it('identifies cash tickers', () => {
    expect(guessCategory('VMFXX')).toBe('cash');
    expect(guessCategory('SPAXX')).toBe('cash');
  });

  it('identifies crypto tickers', () => {
    expect(guessCategory('GBTC')).toBe('crypto');
    expect(guessCategory('IBIT')).toBe('crypto');
  });

  it('identifies composite/balanced funds as other', () => {
    expect(guessCategory('VTIVX')).toBe('other');
    expect(guessCategory('VBIAX')).toBe('other');
    expect(guessCategory('VTMFX')).toBe('other');
  });

  it('uses name fallback for unknown tickers', () => {
    expect(guessCategory('XXXX', 'Vanguard Total International Stock')).toBe('intl_stock');
    expect(guessCategory('XXXX', 'iShares Municipal Bond ETF')).toBe('muni');
    expect(guessCategory('XXXX', 'Some Real Estate Fund')).toBe('reit');
    expect(guessCategory('XXXX', 'Bitcoin Futures ETF')).toBe('crypto');
    expect(guessCategory('XXXX', 'Treasury Bond Fund')).toBe('bond');
    expect(guessCategory('XXXX', 'Target Date 2050 Fund')).toBe('other');
  });

  it('is case insensitive for tickers', () => {
    expect(guessCategory('vti')).toBe('us_stock');
    expect(guessCategory('bnd')).toBe('bond');
  });
});

describe('guessAccountType', () => {
  it('detects Roth accounts', () => {
    expect(guessAccountType('Roth IRA')).toBe('roth');
    expect(guessAccountType('ROTH')).toBe('roth');
    expect(guessAccountType('My Roth IRA - 1234')).toBe('roth');
  });

  it('detects Traditional IRA accounts', () => {
    expect(guessAccountType('Traditional IRA')).toBe('ira');
    expect(guessAccountType('Rollover IRA')).toBe('ira');
    expect(guessAccountType('TRAD IRA')).toBe('ira');
    expect(guessAccountType('Acct: Rollover IRA ending 9999')).toBe('ira');
  });

  it('detects HSA accounts', () => {
    expect(guessAccountType('HSA')).toBe('hsa');
    expect(guessAccountType('Health Savings Account')).toBe('hsa');
    expect(guessAccountType('My Health Savings Account - 4321')).toBe('hsa');
  });

  it('defaults to taxable for unknown strings', () => {
    expect(guessAccountType('12345678')).toBe('taxable');
    expect(guessAccountType('Brokerage')).toBe('taxable');
    expect(guessAccountType('')).toBe('taxable');
  });
});
