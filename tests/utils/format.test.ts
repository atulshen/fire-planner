import { describe, it, expect } from 'vitest';
import { fmt, fmtD, fmtK, parseNum } from '../../src/utils/format';

describe('fmt', () => {
  it('formats numbers with commas', () => {
    expect(fmt(1000)).toBe('1,000');
    expect(fmt(1000000)).toBe('1,000,000');
  });

  it('rounds to zero decimal places', () => {
    expect(fmt(1234.56)).toBe('1,235');
  });
});

describe('fmtD', () => {
  it('formats with specified decimal places', () => {
    expect(fmtD(1234.5, 2)).toBe('1,234.50');
    expect(fmtD(0.123, 1)).toBe('0.1');
  });
});

describe('fmtK', () => {
  it('formats millions with M suffix', () => {
    expect(fmtK(1500000)).toBe('1.5M');
  });

  it('formats thousands with K suffix', () => {
    expect(fmtK(50000)).toBe('50K');
  });

  it('formats small numbers normally', () => {
    expect(fmtK(500)).toBe('500');
  });
});

describe('parseNum', () => {
  it('parses plain numbers', () => {
    expect(parseNum('1234')).toBe(1234);
    expect(parseNum('12.34')).toBe(12.34);
  });

  it('strips dollar signs and commas', () => {
    expect(parseNum('$1,234.56')).toBe(1234.56);
  });

  it('handles parenthesized negatives', () => {
    expect(parseNum('($500)')).toBe(-500);
  });

  it('strips percent signs', () => {
    expect(parseNum('3.5%')).toBe(3.5);
  });

  it('returns 0 for empty/invalid strings', () => {
    expect(parseNum('')).toBe(0);
    expect(parseNum('N/A')).toBe(0);
  });
});
