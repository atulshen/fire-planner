export const fmt = (n: number): string =>
  n.toLocaleString('en-US', { maximumFractionDigits: 0 });

export const fmtD = (n: number, d: number): string =>
  n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

export const fmtK = (n: number): string =>
  n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(0) + 'K' : fmt(n);

export function parseNum(str: string): number {
  if (!str) return 0;
  const s = str.replace(/[$,%\s]/g, '').replace(/\((.+)\)/, '-$1');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}
