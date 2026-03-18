import type { AccountType, CategoryKey } from '../types';
import { $, esc } from '../utils/dom';
import { fmt, fmtD, fmtK } from '../utils/format';
import { holdings, yieldCache } from '../state/store';
import { getHoldingYield } from '../state/income';
import { getCompositeSplit } from '../calc/allocation';
import { FPL_2025 } from '../constants/aca';

interface IncomeItem {
  ticker: string;
  name: string;
  value: number;
  yield: number;
  income: number;
  category: CategoryKey;
  isMuni: boolean;
}

export function renderInvestmentIncome(): void {
  if (holdings.length === 0) {
    $('investmentIncomeArea').innerHTML = '<div style="color:var(--muted);font-size:0.85rem;">Add holdings to see projected investment income.</div>';
    $('yieldFreshness').textContent = '';
    return;
  }

  // Show data freshness
  const cachedTickers = Object.values(yieldCache).filter((entry) => entry.fetched > 0);
  if (cachedTickers.length > 0) {
    const newest = Math.max(...cachedTickers.map(c => c.fetched || 0));
    const ago = Date.now() - newest;
    const mins = Math.floor(ago / 60000);
    const hours = Math.floor(ago / 3600000);
    const days = Math.floor(ago / 86400000);
    $('yieldFreshness').textContent = 'Live data: ' + (
      days > 0 ? `${days}d ago` : hours > 0 ? `${hours}h ago` : mins > 0 ? `${mins}m ago` : 'just now'
    );
    $('yieldFreshness').style.color = days > 7 ? 'var(--red)' : days > 1 ? 'var(--orange)' : 'var(--accent)';
  } else {
    $('yieldFreshness').textContent = 'Using estimates \u2014 click Fetch Live Data';
    $('yieldFreshness').style.color = 'var(--muted)';
  }

  const cliffAmt = FPL_2025 * 4;

  // Calculate income by account and holding
  const byAccount: Record<AccountType, IncomeItem[]> = { roth: [], hsa: [], ira: [], taxable: [] };
  let totalIncome = 0, taxableIncome = 0, muniIncome = 0;

  for (const h of holdings) {
    const val = h.shares * h.price;
    const yld = getHoldingYield(h);
    const annualIncome = val * (yld / 100);
    const isMuni = h.category === 'muni';
    const item: IncomeItem = { ticker: h.ticker, name: h.name, value: val, yield: yld, income: annualIncome, category: h.category, isMuni };
    byAccount[h.account].push(item);
    totalIncome += annualIncome;
    if (h.account === 'taxable') {
      if (isMuni) {
        muniIncome += annualIncome; // federal tax-exempt, but counts toward ACA MAGI
      } else {
        taxableIncome += annualIncome;
      }
    }
  }

  // Qualified vs ordinary
  let qualifiedIncome = 0, ordinaryIncome = 0;
  for (const item of byAccount.taxable) {
    if (item.isMuni) continue;
    const h = holdings.find(hh => hh.ticker === item.ticker && hh.account === 'taxable');
    const split = h ? getCompositeSplit(h) : null;
    if (split) {
      const stockPct = (split.us_stock || 0) + (split.intl_stock || 0);
      const muniPct = split.muni || 0;
      const bondPct = (split.bond || 0) + (split.reit || 0) + (split.cash || 0);
      qualifiedIncome += item.income * stockPct;
      ordinaryIncome += item.income * bondPct;
      muniIncome += item.income * muniPct;
    } else if (['bond', 'reit', 'cash'].includes(item.category)) {
      ordinaryIncome += item.income;
    } else {
      qualifiedIncome += item.income;
    }
  }

  // MAGI impact + conversion room
  const magiFromDividends = taxableIncome + muniIncome;
  const shelteredIncome = totalIncome - magiFromDividends;
  const totalMagi = magiFromDividends;
  const conversionRoom = Math.max(cliffAmt - totalMagi - 1000, 0);

  // Summary stats
  const summaryHtml = `
    <div class="stat-row" style="margin-bottom:1.25rem;">
      <div class="stat-card">
        <div class="stat-label">MAGI-Relevant Investment Income</div>
        <div class="stat-value">$${fmt(Math.round(magiFromDividends))}<span style="font-size:0.7rem;color:var(--muted)">/yr</span></div>
        <div style="font-size:0.65rem;color:var(--muted);margin-top:2px;">Taxable account income plus muni income</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">All-Accounts Estimated Yield</div>
        <div class="stat-value">$${fmt(Math.round(totalIncome))}<span style="font-size:0.7rem;color:var(--muted)">/yr</span></div>
        <div style="font-size:0.65rem;color:var(--muted);margin-top:2px;">Includes IRA, Roth, and HSA income that stays in those accounts</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Taxable Income (federal)</div>
        <div class="stat-value" style="color:${taxableIncome > 0 ? 'var(--orange)' : 'var(--accent)'}">$${fmt(Math.round(taxableIncome))}<span style="font-size:0.7rem;color:var(--muted)">/yr</span></div>
      </div>
      ${muniIncome > 0 ? `<div class="stat-card">
        <div class="stat-label">Muni Income (tax-exempt)</div>
        <div class="stat-value" style="color:var(--teal, #2dd4bf)">$${fmt(Math.round(muniIncome))}<span style="font-size:0.7rem;color:var(--muted)">/yr</span></div>
        <div style="font-size:0.65rem;color:var(--muted);margin-top:2px;">Federal tax-free, counts for ACA MAGI</div>
      </div>` : ''}
      <div class="stat-card">
        <div class="stat-label">Sheltered Account Income</div>
        <div class="stat-value" style="color:${shelteredIncome > 0 ? 'var(--blue)' : 'var(--accent)'}">$${fmt(Math.round(shelteredIncome))}<span style="font-size:0.7rem;color:var(--muted)">/yr</span></div>
        <div style="font-size:0.65rem;color:var(--muted);margin-top:2px;">IRA, Roth, and HSA income not counted in current MAGI</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Qualified Dividends (15%)</div>
        <div class="stat-value" style="color:var(--accent)">$${fmt(Math.round(qualifiedIncome))}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Ordinary Income (taxed as income)</div>
        <div class="stat-value" style="color:${ordinaryIncome > 0 ? 'var(--red)' : 'var(--accent)'}">$${fmt(Math.round(ordinaryIncome))}</div>
      </div>
    </div>`;

  // Conversion room callout
  const convCallout = `
    <div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:1rem 1.25rem;margin-bottom:1.25rem;">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.75rem;">
        <div>
          <div style="font-size:0.75rem;text-transform:uppercase;font-weight:600;color:var(--muted);letter-spacing:0.04em;margin-bottom:0.25rem;">Roth Conversion Room (under ACA cliff)</div>
          <div style="font-size:0.85rem;color:var(--muted);">
            Retirement MAGI is modeled as investment income only. Current MAGI-relevant investment income is <strong style="color:var(--text)">$${fmt(Math.round(totalMagi))}</strong>.
            ACA cliff at $${fmt(Math.round(cliffAmt))}.
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:1.4rem;font-weight:700;color:${conversionRoom > 10000 ? 'var(--accent)' : conversionRoom > 0 ? 'var(--orange)' : 'var(--red)'}">
            $${fmt(Math.round(conversionRoom))}
          </div>
          <div style="font-size:0.75rem;color:var(--muted);">available for conversion</div>
        </div>
      </div>
    </div>`;

  // Per-holding table
  function renderAccountSection(acctLabel: string, items: IncomeItem[], taxNote: string): string {
    if (items.length === 0) return '';
    const total = items.reduce((s, i) => s + i.income, 0);
    const rows = items.sort((a, b) => b.income - a.income).map((i) => `
      <tr>
        <td style="font-weight:600;">${esc(i.ticker)}</td>
        <td style="color:var(--muted);max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(i.name)}</td>
        <td style="text-align:right;">$${fmtK(i.value)}</td>
        <td style="text-align:right;">${fmtD(i.yield, 1)}%</td>
        <td style="text-align:right;font-weight:600;">$${fmt(Math.round(i.income))}</td>
        <td style="text-align:right;color:var(--muted);">$${fmt(Math.round(i.income / 12))}/mo</td>
      </tr>
    `).join('');

    return `
      <div style="margin-bottom:1.25rem;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
          <div style="font-size:0.85rem;font-weight:700;">${acctLabel}</div>
          <div style="font-size:0.85rem;">
            <span style="color:var(--muted);">Annual:</span>
            <strong>$${fmt(Math.round(total))}</strong>
            <span style="color:var(--muted);margin-left:0.75rem;">Monthly:</span>
            <strong>$${fmt(Math.round(total / 12))}</strong>
          </div>
        </div>
        <div style="font-size:0.75rem;color:var(--muted);margin-bottom:0.5rem;">${taxNote}</div>
        <div style="overflow-x:auto;border:1px solid var(--border);border-radius:8px;">
          <table class="co-sweep-table">
            <thead><tr>
              <th style="text-align:left;">Ticker</th><th style="text-align:left;">Name</th>
              <th>Value</th><th>Yield</th><th>Annual</th><th>Monthly</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  }

  const tablesHtml =
    renderAccountSection('Taxable Account (MAGI relevant)', byAccount.taxable,
      'This income counts toward your MAGI. Qualified dividends taxed at 15%, interest/REIT/bond income taxed as ordinary income.') +
    renderAccountSection('Traditional IRA (not current MAGI)', byAccount.ira,
      'Income stays in the account and is not taxed until withdrawal. It is shown here for completeness, not because it affects current MAGI.') +
    renderAccountSection('Roth IRA (not current MAGI)', byAccount.roth,
      'Income stays in the account tax-free. It does not affect current MAGI and is shown here only as an estimate.') +
    renderAccountSection('HSA (not current MAGI in this model)', byAccount.hsa,
      'Income stays sheltered. This planner models HSA assets like Roth assets for planning purposes, so this section is informational only.');

  $('investmentIncomeArea').innerHTML = summaryHtml + convCallout + tablesHtml;
}
