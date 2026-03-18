import { $, esc } from '../utils/dom';
import { fmtD } from '../utils/format';
import type { CategoryKey, CompositeSplit, YieldCacheEntry } from '../types';
import { holdings, yieldCache } from '../state/store';
import { CATEGORIES } from '../constants/categories';
import { getCompositeSplit } from '../calc/allocation';

interface SymbolRow {
  ticker: string;
  name: string;
  category: CategoryKey | null;
  allocation: CompositeSplit | null;
  assetClass: string;
  yield: number;
  expenseRatio: number | null;
  brokerages: string[];
  holdingsCount: number;
  fetched: number;
}

interface SymbolCatalogRenderOptions {
  editingTicker?: string | null;
}

function getBrokerageName(brokerage?: string): string {
  return brokerage?.trim() || 'Unspecified';
}

function describeAllocation(split: CompositeSplit | null, category: CategoryKey | null): string {
  if (split) {
    return Object.entries(split)
      .filter(([, pct]) => pct > 0)
      .map(([cat, pct]) => `${CATEGORIES[cat as CategoryKey]?.label || cat}: ${fmtD(pct * 100, 0)}%`)
      .join(' • ');
  }
  if (category) return CATEGORIES[category]?.label || category;
  return 'Unknown';
}

function describeAssetClass(assetClass: string, split: CompositeSplit | null, category: CategoryKey | null): string {
  if (split) return describeAllocation(split, category);
  if (assetClass && assetClass !== 'Other') return assetClass;
  return describeAllocation(null, category);
}

function getYahooFinanceUrl(ticker: string): string {
  return `https://finance.yahoo.com/quote/${encodeURIComponent(ticker)}`;
}

function formatAllocationForInput(split: CompositeSplit | null): string {
  if (!split) return '';
  return Object.entries(split)
    .filter(([, pct]) => pct > 0)
    .map(([cat, pct]) => `${cat}=${fmtD(pct * 100, 2)}`)
    .join(', ');
}

function renderCategoryOptions(selected: CategoryKey | null): string {
  return [
    '<option value="">Unspecified</option>',
    ...Object.entries(CATEGORIES).map(([key, info]) => (
      `<option value="${key}"${selected === key ? ' selected' : ''}>${esc(info.label)}</option>`
    )),
  ].join('');
}

function getSymbolRows(): SymbolRow[] {
  const tickers = new Set<string>([
    ...holdings.map((holding) => holding.ticker.toUpperCase()),
    ...Object.keys(yieldCache),
  ]);

  return [...tickers].map((ticker) => {
    const symbolHoldings = holdings.filter((holding) => holding.ticker.toUpperCase() === ticker);
    const cache = yieldCache[ticker] as YieldCacheEntry | undefined;
    const firstHolding = symbolHoldings[0];
    const allocation = cache?.allocation ?? (firstHolding ? getCompositeSplit(firstHolding) : null);
    const category = cache?.detectedCategory ?? firstHolding?.category ?? null;
    return {
      ticker,
      name: cache?.name || firstHolding?.name || ticker,
      category,
      allocation,
      assetClass: cache?.assetClass || (category ? CATEGORIES[category]?.label || category : 'Unknown'),
      yield: cache?.yield ?? firstHolding?.dividendYield ?? 0,
      expenseRatio: cache?.expenseRatio ?? null,
      brokerages: [...new Set(symbolHoldings.map((holding) => getBrokerageName(holding.brokerage)))].sort((a, b) => a.localeCompare(b)),
      holdingsCount: symbolHoldings.length,
      fetched: cache?.fetched ?? 0,
    };
  }).sort((a, b) => a.ticker.localeCompare(b.ticker));
}

export function renderSymbolCatalogPage(options: SymbolCatalogRenderOptions = {}): void {
  const area = $('symbolCatalogArea');
  const rows = getSymbolRows();
  if (rows.length === 0) {
    area.innerHTML = '<div class="empty-state"><p>Add or import holdings to build the symbol catalog.</p></div>';
    return;
  }

  const compositeCount = rows.filter((row) => row.allocation).length;
  const liveCount = rows.filter((row) => row.fetched > 0).length;

  area.innerHTML = `
    <div class="dd-summary-cards" style="margin-bottom:1.25rem;">
      <div class="dd-summary-card">
        <div class="label">Tracked Symbols</div>
        <div class="value">${rows.length}</div>
        <div class="sub">Unique symbols across holdings and cached metadata</div>
      </div>
      <div class="dd-summary-card">
        <div class="label">Composite Splits</div>
        <div class="value">${compositeCount}</div>
        <div class="sub">Symbols with multi-asset allocations</div>
      </div>
      <div class="dd-summary-card">
        <div class="label">Live Metadata</div>
        <div class="value">${liveCount}</div>
        <div class="sub">Symbols refreshed from the data fetcher</div>
      </div>
    </div>

    <div style="overflow-x:auto;border:1px solid var(--border);border-radius:10px;">
      <table class="co-sweep-table">
        <thead><tr>
          <th style="text-align:left">Ticker</th>
          <th style="text-align:left">Name</th>
          <th style="text-align:left">Asset Class</th>
          <th>Yield</th>
          <th>Expense Ratio</th>
          <th>Holdings</th>
          <th style="text-align:left">Brokerages</th>
          <th>Actions</th>
        </tr></thead>
        <tbody>${rows.map((row) => {
          const isEditing = options.editingTicker === row.ticker;
          return `
          <tr>
            <td>${row.ticker}</td>
            <td style="min-width:260px;white-space:normal;line-height:1.4;" title="${esc(row.name)}">
              <a href="${getYahooFinanceUrl(row.ticker)}" target="_blank" rel="noreferrer noopener" style="color:var(--blue);text-decoration:none;">
                ${esc(row.name)}
              </a>
            </td>
            <td style="min-width:280px;white-space:normal;line-height:1.4;">${describeAssetClass(row.assetClass, row.allocation, row.category)}</td>
            <td>${fmtD(row.yield, 1)}%</td>
            <td>${row.expenseRatio != null ? `${fmtD(row.expenseRatio, row.expenseRatio < 0.1 ? 3 : 2)}%` : '—'}</td>
            <td>${row.holdingsCount}</td>
            <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${row.brokerages.length > 0 ? row.brokerages.join(', ') : '—'}</td>
            <td><button class="btn" style="padding:0.25rem 0.5rem;font-size:0.75rem;" onclick="startSymbolEdit('${row.ticker}')">${isEditing ? 'Editing' : 'Edit'}</button></td>
          </tr>
          ${isEditing ? `
            <tr>
              <td colspan="8" style="background:var(--bg);padding:0;">
                <div style="padding:1rem;border-top:1px solid var(--border);">
                  <div class="grid-2" style="margin-bottom:0.75rem;">
                    <label style="display:flex;flex-direction:column;gap:0.35rem;font-size:0.8rem;color:var(--muted);">
                      <span>Name</span>
                      <input id="symbolEditName" class="input" value="${esc(row.name)}" />
                    </label>
                    <label style="display:flex;flex-direction:column;gap:0.35rem;font-size:0.8rem;color:var(--muted);">
                      <span>Asset Class</span>
                      <input id="symbolEditAssetClass" class="input" value="${esc(row.assetClass === 'Unknown' ? '' : row.assetClass)}" placeholder="US Equity, Large Blend, Bond, etc." />
                    </label>
                    <label style="display:flex;flex-direction:column;gap:0.35rem;font-size:0.8rem;color:var(--muted);">
                      <span>Planner Category</span>
                      <select id="symbolEditCategory" class="input">${renderCategoryOptions(row.category)}</select>
                    </label>
                    <label style="display:flex;flex-direction:column;gap:0.35rem;font-size:0.8rem;color:var(--muted);">
                      <span>Allocation Split</span>
                      <input id="symbolEditAllocation" class="input" value="${esc(formatAllocationForInput(row.allocation))}" placeholder="us_stock=60, intl_stock=40" />
                    </label>
                    <label style="display:flex;flex-direction:column;gap:0.35rem;font-size:0.8rem;color:var(--muted);">
                      <span>Yield (%)</span>
                      <input id="symbolEditYield" class="input" type="number" step="0.01" value="${row.yield ? fmtD(row.yield, 2) : ''}" placeholder="0.00" />
                    </label>
                    <label style="display:flex;flex-direction:column;gap:0.35rem;font-size:0.8rem;color:var(--muted);">
                      <span>Expense Ratio (%)</span>
                      <input id="symbolEditExpenseRatio" class="input" type="number" step="0.001" value="${row.expenseRatio != null ? fmtD(row.expenseRatio, 3) : ''}" placeholder="0.000" />
                    </label>
                  </div>
                  <div style="font-size:0.78rem;color:var(--muted);margin-bottom:0.75rem;">
                    Allocation split accepts category percentages like <code>us_stock=60, intl_stock=40</code>. Leave blank to clear.
                  </div>
                  <div style="display:flex;gap:0.5rem;justify-content:flex-end;">
                    <button class="btn" onclick="cancelSymbolEdit()">Cancel</button>
                    <button class="btn primary" onclick="saveSymbolEdit('${row.ticker}')">Save</button>
                  </div>
                </div>
              </td>
            </tr>
          ` : ''}
        `;
        }).join('')}</tbody>
      </table>
    </div>`;
}
