import type { AccountType } from '../types';
import { $ } from '../utils/dom';
import { fmt, fmtD } from '../utils/format';
import { holdings } from '../state/store';
import { ACCOUNT_LABELS, ACCOUNT_COLORS } from '../constants/categories';

export function renderAccountBreakdown(): void {
  const accts: Record<AccountType, number> = { roth: 0, hsa: 0, ira: 0, taxable: 0 };
  for (const h of holdings) accts[h.account] = (accts[h.account] || 0) + h.shares * h.price;
  const total = Object.values(accts).reduce((a, b) => a + b, 0);

  if (total === 0) {
    $('accountBreakdownArea').innerHTML = '<div class="empty-state"><p>No accounts yet.</p></div>';
    return;
  }

  const bars = Object.entries(accts).filter(([, v]) => v > 0).map(([acct, val]) => {
    const pct = (val / total) * 100;
    return `
      <div style="margin-bottom:1rem;">
        <div style="display:flex;justify-content:space-between;font-size:0.85rem;margin-bottom:0.35rem;">
          <span style="font-weight:600;">${ACCOUNT_LABELS[acct as keyof typeof ACCOUNT_LABELS]}</span>
          <span>$${fmt(val)} <span style="color:var(--muted)">(${fmtD(pct, 1)}%)</span></span>
        </div>
        <div style="width:100%;height:8px;background:var(--bg);border-radius:4px;overflow:hidden;">
          <div style="width:${pct}%;height:100%;background:${ACCOUNT_COLORS[acct as keyof typeof ACCOUNT_COLORS]};border-radius:4px;"></div>
        </div>
      </div>`;
  }).join('');

  // Tax advantage notes
  const taxNotes: string[] = [];
  if (accts.roth > 0) taxNotes.push('<span style="color:var(--blue)">Roth</span>: Tax-free growth & withdrawals');
  if (accts.hsa > 0) taxNotes.push('<span style="color:#14b8a6">HSA</span>: Tax-free for qualified medical spending; modeled here like Roth assets');
  if (accts.ira > 0) taxNotes.push('<span style="color:var(--purple)">Trad IRA</span>: Tax-deferred, taxed on withdrawal');
  if (accts.taxable > 0) taxNotes.push('<span style="color:var(--orange)">Taxable</span>: Capital gains tax applies');

  $('accountBreakdownArea').innerHTML = `
    ${bars}
    <div style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--border);">
      <div style="font-size:0.75rem;color:var(--muted);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:0.5rem;">Tax Treatment</div>
      ${taxNotes.map(n => `<div style="font-size:0.8rem;margin-bottom:0.3rem;">${n}</div>`).join('')}
    </div>`;
}
