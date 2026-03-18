import { describe, it, expect } from 'vitest';
import { parseCsv } from '../../src/utils/csv';

describe('parseCsv', () => {
  it('parses simple CSV', () => {
    const result = parseCsv('a,b,c\n1,2,3');
    expect(result).toEqual([['a','b','c'], ['1','2','3']]);
  });

  it('handles quoted fields', () => {
    const result = parseCsv('"hello world",b,c');
    expect(result[0][0]).toBe('hello world');
  });

  it('handles commas inside quotes', () => {
    const result = parseCsv('"Smith, John",30,NY');
    expect(result[0][0]).toBe('Smith, John');
    expect(result[0][1]).toBe('30');
  });

  it('handles escaped quotes (double quotes)', () => {
    const result = parseCsv('"He said ""hello""",b');
    expect(result[0][0]).toBe('He said "hello"');
  });

  it('handles CRLF line endings', () => {
    const result = parseCsv('a,b\r\n1,2');
    expect(result).toEqual([['a','b'], ['1','2']]);
  });

  it('skips empty rows', () => {
    const result = parseCsv('a,b\n\n1,2');
    expect(result).toHaveLength(2);
  });

  it('handles last row without newline', () => {
    const result = parseCsv('a,b\n1,2');
    expect(result).toHaveLength(2);
    expect(result[1]).toEqual(['1','2']);
  });

  it('handles single column CSV', () => {
    const result = parseCsv('a\nb\nc');
    expect(result).toEqual([['a'], ['b'], ['c']]);
  });
});
