import { $, esc } from '../utils/dom';
import { fmt, fmtD } from '../utils/format';
import { holdings, filtered, activeAccount, holdingsSort, sortHoldings } from '../state/store';
import { getHoldingYield } from '../state/income';
import { getCompositeSplit } from '../calc/allocation';
import { CATEGORIES, ACCOUNT_SHORT_LABELS } from '../constants/categories';

// These will be set by the UI layer when modals are initialized
let editHolding: (index: number) => void = () => {};
let deleteHolding: (index: number) => void = () => {};

export function setHoldingActions(edit: (index: number) => void, del: (index: number) => void): void {
  editHolding = edit;
  deleteHolding = del;
  (window as any).editHolding = edit;
  (window as any).deleteHolding = del;
}

// Expose sortHoldings globally for onclick handlers in generated HTML
(window as any).sortHoldings = sortHoldings;

export function renderHoldings(): void {
  const list = filtered();
  if (list.length === 0) {
    $('holdingsArea').innerHTML = '<div class="empty-state"><p>No holdings yet. Click "+ Add Holding" to get started.</p></div>';
    return;
  }

  const totalValue = list.reduce((s, h) => s + h.shares * h.price, 0);

  // Sort if a sort key is active
  const sorted = [...list];
  if (holdingsSort.key) {
    const dir = holdingsSort.asc ? 1 : -1;
    sorted.sort((a, b) => {
      let va: any, vb: any;
      switch (holdingsSort.key) {
        case 'ticker': va = a.ticker.toLowerCase(); vb = b.ticker.toLowerCase(); return va < vb ? -dir : va > vb ? dir : 0;
        case 'shares': va = a.shares; vb = b.shares; break;
        case 'price': va = a.price; vb = b.price; break;
        case 'value': va = a.shares * a.price; vb = b.shares * b.price; break;
        case 'cost': va = a.costBasis; vb = b.costBasis; break;
        case 'gain': va = (a.price - a.costBasis) * a.shares; vb = (b.price - b.costBasis) * b.shares; break;
        case 'yield': va = getHoldingYield(a); vb = getHoldingYield(b); break;
        case 'weight': va = a.shares * a.price; vb = b.shares * b.price; break; // same as value
        default: return 0;
      }
      return (va - vb) * dir;
    });
  }

  let rows = sorted
    .map((h, i) => {
      const value = h.shares * h.price;
      const gain = (h.price - h.costBasis) * h.shares;
      const gainPct = h.costBasis > 0 ? ((h.price - h.costBasis) / h.costBasis) * 100 : 0;
      const weight = totalValue > 0 ? (value / totalValue) * 100 : 0;
      const cls = gain >= 0 ? 'change-up' : 'change-down';
      const sign = gain >= 0 ? '+' : '';
      const realIndex = holdings.indexOf(h);
      const acctTag = `<span class="tax-tag ${h.account}">${ACCOUNT_SHORT_LABELS[h.account]}</span>`;
      const brokerTag = h.brokerage ? `<span class="broker-tag">${esc(h.brokerage)}</span>` : '';

      const yld = getHoldingYield(h);
      const annDiv = value * (yld / 100);

      return `<tr>
        <td><span class="ticker">${esc(h.ticker)}</span>${activeAccount === 'all' ? acctTag : ''}${brokerTag}${getCompositeSplit(h) ? '<span class="tax-tag" style="background:#854d0e;color:#fbbf24;margin-left:0.25rem;" title="Composite fund \u2014 split across categories for allocation">MIX</span>' : ''}<br><span class="ticker-name">${esc(h.name)}</span></td>
        <td class="right">${fmtD(h.shares, h.shares % 1 ? 3 : 0)}</td>
        <td class="right">$${fmtD(h.price, 2)}</td>
        <td class="right">$${fmt(value)}</td>
        <td class="right">$${fmtD(h.costBasis, 2)}</td>
        <td class="right ${cls}">${sign}$${fmt(gain)}<br><span style="font-size:0.75rem">${sign}${fmtD(gainPct, 1)}%</span></td>
        <td class="right" style="color:var(--accent);">${fmtD(yld, 1)}%<br><span style="font-size:0.75rem;color:var(--muted);">$${fmt(Math.round(annDiv))}/yr</span></td>
        <td><span class="weight-bar-bg"><span class="weight-bar-fill" style="width:${weight}%;background:${CATEGORIES[h.category]?.color || '#999'}"></span></span>${fmtD(weight, 1)}%</td>
        <td class="right">
          <button class="btn" style="padding:0.25rem 0.5rem;font-size:0.75rem;" onclick="editHolding(${realIndex})">Edit</button>
          <button class="btn danger" style="padding:0.25rem 0.5rem;font-size:0.75rem;" onclick="deleteHolding(${realIndex})">Del</button>
        </td>
      </tr>`;
    })
    .join('');

  const arrow = (key: string) => holdingsSort.key === key ? (holdingsSort.asc ? ' \u25B2' : ' \u25BC') : '';
  const sh = (key: string, label: string, cls?: string) => `<th class="${cls || ''}" style="cursor:pointer;user-select:none;" onclick="sortHoldings('${key}')">${label}${arrow(key)}</th>`;

  $('holdingsArea').innerHTML = `
    <table class="holdings-table">
      <thead><tr>
        ${sh('ticker', 'Ticker', '')}${sh('shares', 'Shares', 'right')}${sh('price', 'Price', 'right')}
        ${sh('value', 'Value', 'right')}${sh('cost', 'Cost', 'right')}${sh('gain', 'Gain/Loss', 'right')}
        ${sh('yield', 'Yield', 'right')}${sh('weight', 'Weight', '')}<th></th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}
