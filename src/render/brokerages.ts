import { $, esc } from '../utils/dom';
import { fmt, fmtD, fmtK } from '../utils/format';
import { holdings } from '../state/store';
import { getHoldingYield } from '../state/income';
import { ACCOUNT_LABELS } from '../constants/categories';

function getBrokerageName(brokerage?: string): string {
  return brokerage?.trim() || 'Unspecified';
}

export function getBrokerageOptions(): string[] {
  return [...new Set(holdings.map((holding) => getBrokerageName(holding.brokerage)))].sort((a, b) => a.localeCompare(b));
}

export function renderBrokeragePage(activeBrokerage: string): void {
  const area = $('brokerageViewArea');
  if (holdings.length === 0) {
    area.innerHTML = '<div class="empty-state"><p>Add or import holdings to see brokerage breakdowns.</p></div>';
    return;
  }

  const brokerageOptions = getBrokerageOptions();
  const rows = holdings.filter((holding) => activeBrokerage === 'all' || getBrokerageName(holding.brokerage) === activeBrokerage);
  const summaryRows = brokerageOptions.map((brokerage) => {
    const brokerHoldings = holdings.filter((holding) => getBrokerageName(holding.brokerage) === brokerage);
    const totalValue = brokerHoldings.reduce((sum, holding) => sum + holding.shares * holding.price, 0);
    const annualIncome = brokerHoldings.reduce((sum, holding) => {
      const value = holding.shares * holding.price;
      return sum + value * (getHoldingYield(holding) / 100);
    }, 0);
    return {
      brokerage,
      positions: brokerHoldings.length,
      totalValue,
      annualIncome,
    };
  });

  const filterHtml = `
    <div class="broker-filter-row">
      <button class="broker-filter ${activeBrokerage === 'all' ? 'active' : ''}" onclick='setBrokerageFilter("all")'>All Brokerages</button>
      ${brokerageOptions.map((brokerage) => `
        <button class="broker-filter ${activeBrokerage === brokerage ? 'active' : ''}" onclick='setBrokerageFilter(${JSON.stringify(brokerage)})'>${esc(brokerage)}</button>
      `).join('')}
    </div>`;

  const summaryHtml = `
    <div class="dd-summary-cards" style="margin-bottom:1.25rem;">
      ${summaryRows.map((row) => `
        <div class="dd-summary-card">
          <div class="label">${esc(row.brokerage)}</div>
          <div class="value">$${fmtK(row.totalValue)}</div>
          <div class="sub">${row.positions} positions • est. $${fmt(Math.round(row.annualIncome))}/yr income</div>
        </div>
      `).join('')}
    </div>`;

  const tableHtml = rows.length === 0
    ? '<div class="empty-state"><p>No holdings match this brokerage filter.</p></div>'
    : `
      <div style="overflow-x:auto;border:1px solid var(--border);border-radius:10px;">
        <table class="co-sweep-table">
          <thead><tr>
            <th style="text-align:left">Brokerage</th>
            <th style="text-align:left">Ticker</th>
            <th style="text-align:left">Name</th>
            <th style="text-align:left">Account</th>
            <th style="text-align:left">Acct #</th>
            <th>Value</th>
            <th>Yield</th>
            <th>Est. Income</th>
          </tr></thead>
          <tbody>${rows
            .sort((a, b) => {
              const brokerageSort = getBrokerageName(a.brokerage).localeCompare(getBrokerageName(b.brokerage));
              if (brokerageSort !== 0) return brokerageSort;
              return a.ticker.localeCompare(b.ticker);
            })
            .map((holding) => {
              const value = holding.shares * holding.price;
              const yieldPct = getHoldingYield(holding);
              const income = value * (yieldPct / 100);
              return `
                <tr>
                  <td>${esc(getBrokerageName(holding.brokerage))}</td>
                  <td>${esc(holding.ticker)}</td>
                  <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(holding.name)}</td>
                  <td>${ACCOUNT_LABELS[holding.account]}</td>
                  <td>${holding.accountNumber ? esc(holding.accountNumber) : '<span style="color:var(--muted);">—</span>'}</td>
                  <td>$${fmtK(value)}</td>
                  <td>${fmtD(yieldPct, 1)}%</td>
                  <td>$${fmt(Math.round(income))}</td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;

  area.innerHTML = filterHtml + summaryHtml + tableHtml;
}
