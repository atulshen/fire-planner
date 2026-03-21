import './styles.css';

import type { AccountType, CategoryKey, FilingStatus, Holding, YieldCache, YieldCacheEntry } from './types';
import { $, esc } from './utils/dom';
import { fmt, fmtD, fmtK, parseNum } from './utils/format';
import { parseCsv } from './utils/csv';
import { CATEGORIES, ACCOUNT_LABELS, DEFAULT_TARGETS } from './constants/categories';
import { PRESETS } from './constants/presets';
import {
  COMPOSITE_FUNDS,
  CASH_TICKERS,
} from './constants/tickers';
import {
  holdings,
  targets,
  yieldCache,
  filtered,
  persist,
  persistYieldCache,
  setHoldings,
  setTargets,
  setYieldCache,
  setActiveAccount,
  setOnSortChange,
  createDemoHoldings,
  createDemoYieldCache,
  holdingsSort,
} from './state/store';
import { getInvestmentIncome, getMagi, getHoldingYield, lookupYield, estimateYieldByCategory } from './state/income';
import { renderSummary } from './render/summary';
import { renderHoldings, setHoldingActions } from './render/holdings';
import { renderAllocation } from './render/allocation';
import { renderSuggestions } from './render/suggestions';
import { renderAccountBreakdown } from './render/account-breakdown';
import { renderInvestmentIncome } from './render/investment-income';
import { renderTaxEfficiency } from './render/tax-efficiency';
import { renderBrokeragePage } from './render/brokerages';
import { renderSymbolCatalogPage } from './render/symbol-catalog';
import { calcAcaSubsidy, calcAcaSubsidyForYear, estimateBenchmarkPremium, estimateGoldPremium, getAcaCliff } from './calc/aca';
import { calcFederalIncomeTax, calcPayrollTax, calcProgressiveTax, calcTaxableSocialSecurity, getTopOfOrdinaryBracketGrossIncome } from './calc/tax';
import { recommendRothConversion } from './calc/conversion';
import { getIrmaaSurcharge, getMedicareAnnualCost } from './calc/medicare';
import { ACA_FPL_ADDITIONAL_PERSON_BASELINE, ACA_FPL_BASELINE, ACA_PLANNING_BASELINE_LABEL } from './constants/aca';
import { IRMAA_BRACKETS, MEDICARE_PLANNING_BASELINE_LABEL } from './constants/medicare';
import { PLANNING_GROWTH_RATES } from './constants/planning';
import { TAX_PLANNING_BASELINE_LABEL } from './constants/tax';
import { CATEGORY_TOTAL_RETURNS } from './constants/returns';
import { simulateDrawdown, getRmdFactor } from './calc/drawdown';
import { guessAccountType, guessCategory } from './calc/category';
import { calculateFirePlan } from './calc/fire';
import { renderPlannerPage } from './render/planner';
import { estimateAccountReturn, estimateAccountYield } from './calc/account-assumptions';
import {
  deriveInvestedTargetMix,
  estimateAccountReturnFromBalances,
  estimateAccountYieldFromBalances,
  rebalanceInvestedAccounts,
} from './calc/rebalance';
import {
  buildDealchartsQueries,
  emptySymbolLookupResult,
  hasSymbolLookupData,
  inferCategoryFromTickerAndName,
  isLikelyFundTicker,
  mergeSymbolLookupResults,
  parseEodhdEodPrice,
  parseDealchartsFundFacts,
  parseStockAnalysisOverview,
  pickDealchartsSearchResult,
} from './calc/symbol-data';

type AppPage = 'planner' | 'portfolio' | 'brokerages' | 'symbols' | 'drawdown' | 'conversion' | 'healthcare';

const APP_HTML = `
<header>
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 2C6.48 2 2 6 2 10c0 5.33 10 12 10 12s10-6.67 10-12c0-4-4.48-8-10-8z"/>
    <path d="M12 6v4l2 2"/>
  </svg>
  <h1>FIRE Planner</h1>
  <span>Unified Planner</span>
  <nav>
    <a href="#" onclick="exportBackup(event)" style="font-size:0.75rem;opacity:0.7;">Backup</a>
    <a href="#" onclick="importBackup(event)" style="font-size:0.75rem;opacity:0.7;">Restore</a>
    <a href="#" onclick="loadDemoPortfolio(event)" style="color:var(--accent);font-size:0.75rem;opacity:0.8;">Demo Portfolio</a>
  </nav>
</header>

<main>
  <div class="global-bar">
    <div class="phase-tabs">
      <div class="phase-group phase-group-earning">
        <div class="phase-group-head">
          <div class="phase-label">Earning Phase</div>
        </div>
        <div class="page-tabs">
          <button class="page-tab active" data-page="planner" onclick="switchPage('planner')">Retirement Age Calculator</button>
        </div>
      </div>
      <div class="phase-group phase-group-retirement">
        <div class="phase-group-head">
          <div class="phase-label">Retirement Phase</div>
          <div class="phase-age-control">
            <label for="retirementAge">Retirement Age <span class="phase-meta" id="retirementAgeAutoTag">(auto-updated)</span></label>
            <input type="number" id="retirementAge" value="55" min="18" max="100">
          </div>
        </div>
        <div class="page-tabs">
          <button class="page-tab" data-page="portfolio" onclick="switchPage('portfolio')">Portfolio</button>
          <button class="page-tab" data-page="brokerages" onclick="switchPage('brokerages')">Brokerages</button>
          <button class="page-tab" data-page="symbols" onclick="switchPage('symbols')">Symbols</button>
          <button class="page-tab" data-page="drawdown" onclick="switchPage('drawdown')">Drawdown Plan</button>
          <button class="page-tab" data-page="conversion" onclick="switchPage('conversion')">Roth Conversion Calculator</button>
          <button class="page-tab" data-page="healthcare" onclick="switchPage('healthcare')">Healthcare</button>
        </div>
      </div>
    </div>
  </div>

  <div class="app-disclosure">
    <strong>Disclosure:</strong> This app is an educational planning tool and does not provide financial, tax, legal, or investment advice. For advice specific to your situation, consult a qualified financial advisor or other licensed professional. The app runs locally in your browser and stores your data in local storage; your data does not leave the browser except when you choose live symbol lookups or price/yield refreshes.
  </div>

  <div class="page-section active" id="pagePlanner">
    <div class="planner-layout">
      <div class="panel">
        <h2>Earning Phase Inputs</h2>

        <div class="planner-field">
          <label for="currentAge">Current Age</label>
          <input type="number" id="currentAge" value="30" min="18" max="80">
        </div>

        <div class="planner-row">
          <div class="planner-field">
            <label for="filingStatus">Filing Status</label>
            <select id="filingStatus">
              <option value="single" selected>Single</option>
              <option value="married">Married Filing Jointly</option>
            </select>
          </div>
          <div class="planner-field">
            <label for="householdSize">Household Size</label>
            <input type="number" id="householdSize" value="1" min="1" max="8">
            <div class="planner-hint">Used for ACA / marketplace subsidy estimates</div>
          </div>
        </div>

        <div class="planner-field">
          <label for="annualIncome">Annual Income (pre-tax)</label>
          <input type="number" id="annualIncome" value="100000" step="1000">
        </div>

        <div class="planner-row" id="plannerSpouseInfoRow">
          <div class="planner-field">
            <label for="spouseAge">Spouse Age</label>
            <input type="number" id="spouseAge" value="30" min="18" max="100">
            <div class="planner-hint">Used when filing status is married</div>
          </div>
          <div class="planner-field">
            <label for="spouseAnnualIncome">Spouse Income (pre-tax)</label>
            <input type="number" id="spouseAnnualIncome" value="0" step="1000" min="0">
          </div>
          <div class="planner-field">
            <label for="spouseRetirementAge">Spouse Retirement Age</label>
            <input type="number" id="spouseRetirementAge" value="67" min="18" max="100">
          </div>
        </div>

        <div class="planner-field">
          <label for="annualExpenses">Annual Expenses</label>
          <input type="number" id="annualExpenses" value="40000" step="1000">
          <div class="planner-hint">Your current yearly spending in today's dollars</div>
        </div>

        <div class="planner-field">
          <label for="currentSavings">Current Net Worth</label>
          <input type="number" id="currentSavings" value="50000" step="1000">
        </div>

        <div class="planner-row">
          <div class="planner-field">
            <label for="socialSecurityClaimAge">Claim Social Security At</label>
            <select id="socialSecurityClaimAge">
              <option value="62">Age 62</option>
              <option value="67" selected>Age 67</option>
            </select>
          </div>
          <div class="planner-field">
            <label for="socialSecurityBenefit">Social Security Benefit</label>
            <input type="number" id="socialSecurityBenefit" value="0" step="1000" min="0">
            <div class="planner-hint">Annual benefit in today's dollars. You can find your estimate in your Social Security statement or your my Social Security account at ssa.gov.</div>
          </div>
        </div>

        <div class="planner-row" id="plannerSpouseSocialSecurityRow">
          <div class="planner-field">
            <label for="spouseSocialSecurityClaimAge">Spouse Claim Age</label>
            <select id="spouseSocialSecurityClaimAge">
              <option value="62">Age 62</option>
              <option value="67" selected>Age 67</option>
            </select>
          </div>
          <div class="planner-field">
            <label for="spouseSocialSecurityBenefit">Spouse Social Security</label>
            <input type="number" id="spouseSocialSecurityBenefit" value="0" step="1000" min="0">
            <div class="planner-hint">Annual spouse benefit in today's dollars. Ignored unless filing status is married.</div>
          </div>
        </div>

        <div class="planner-optional">
          <div class="planner-optional-head">
            <h3>Optional Assumptions</h3>
            <div class="planner-hint">These all have defaults. Change them only if you want to tune the model.</div>
          </div>

          <div class="planner-row">
            <div class="planner-field">
              <label for="returnRate">Return Rate (%)</label>
              <input type="number" id="returnRate" value="7" step="0.5" min="0" max="20">
              <div class="planner-hint">Average long-run market return</div>
            </div>
            <div class="planner-field">
              <label for="inflationRate">Inflation (%)</label>
              <input type="number" id="inflationRate" value="3" step="0.5" min="0" max="10">
            </div>
          </div>

          <div class="planner-row">
            <div class="planner-field">
              <label for="withdrawalRate">Withdrawal Rate (%)</label>
              <input type="number" id="withdrawalRate" value="4" step="0.25" min="2" max="6">
              <div class="planner-hint">Safe range: 3.5% to 4%</div>
            </div>
            <div class="planner-field"></div>
          </div>

          <div class="planner-tax-box">
            <div class="planner-field" style="margin-bottom:0;">
              <label for="taxRate">Effective Tax Override (%)</label>
              <input type="number" id="taxRate" value="25" step="1" min="0" max="50">
              <label style="display:flex;align-items:center;gap:0.45rem;margin-top:0.5rem;font-size:0.85rem;color:var(--text);">
                <input type="checkbox" id="taxRateAuto" checked>
                Use federal plus payroll tax tables automatically
              </label>
              <div class="planner-hint" id="taxRateHint"></div>
            </div>
          </div>

          <div class="planner-field">
            <label for="retireExpenses">Retirement Living Expenses (today's dollars)</label>
            <input type="number" id="retireExpenses" value="40000" step="1000">
            <div class="planner-hint">Defaults to your current annual expenses. Non-medical spending only.</div>
          </div>

          <div class="planner-field" style="margin-bottom:0;">
            <label for="longevityAge">Longevity Age</label>
            <input type="number" id="longevityAge" value="95" min="50" max="100">
            <div class="planner-hint">Model how long your assets need to last in retirement. Healthcare is estimated automatically by age.</div>
          </div>
        </div>
      </div>

      <div class="planner-right-col">
        <div class="panel">
          <h2>Retirement Age Calculator</h2>
          <div id="plannerStatusBadge"></div>
          <div class="planner-results-grid" id="plannerResultsGrid"></div>

          <div class="planner-chart-container">
            <h3>Net Worth Projection</h3>
            <canvas id="plannerProjectionChart"></canvas>
          </div>

          <div class="planner-detail-grid">
            <div>
              <h3 class="planner-subheading">Savings Breakdown</h3>
              <div class="planner-breakdown-bar" id="plannerBreakdownBar"></div>
              <div class="planner-breakdown-legend" id="plannerBreakdownLegend"></div>
            </div>
            <div>
              <h3 class="planner-subheading">Milestones</h3>
              <ul class="planner-milestone-list" id="plannerMilestoneList"></ul>
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="planner-scenario-toolbar">
            <div>
              <h2>Scenario Manager</h2>
              <div class="planner-hint">Save multiple planner setups, compare them here, and choose which one the drawdown page should use.</div>
            </div>
            <button class="btn primary" onclick="saveCurrentScenario()">Save Current Scenario</button>
          </div>
          <div id="plannerScenarioManager"></div>
        </div>
      </div>
    </div>
  </div>

  <div class="page-section" id="pagePortfolio">
    <div class="top-bar">
      <div class="account-tabs" id="accountTabs">
        <button class="account-tab active" data-account="all">All Accounts</button>
        <button class="account-tab" data-account="roth">Roth IRA</button>
        <button class="account-tab" data-account="hsa">HSA</button>
        <button class="account-tab" data-account="ira">Traditional IRA</button>
        <button class="account-tab" data-account="taxable">Taxable</button>
      </div>
      <div style="margin-left:auto;display:flex;gap:0.5rem;align-items:center;">
        <button class="btn" onclick="openImportModal()">Import CSV</button>
        <button class="btn" onclick="openCostBasisModal()">Import Cost Basis</button>
        <button class="btn primary" onclick="openAddModal()">+ Add Holding</button>
        <button class="btn" onclick="openTargetModal()">Set Targets</button>
      </div>
    </div>

    <div class="stat-row" id="summaryStats"></div>

    <div class="grid-3">
      <div class="panel" style="grid-column: span 2;">
        <h2>Holdings</h2>
        <div id="holdingsArea"></div>
      </div>

      <div class="panel">
        <h2>Allocation</h2>
        <div id="allocationArea"></div>
      </div>
    </div>

    <div class="grid-2">
      <div class="panel">
        <h2>Trade Suggestions</h2>
        <div id="suggestionsArea"></div>
      </div>

      <div class="panel">
        <h2>Account Breakdown</h2>
        <div id="accountBreakdownArea"></div>
      </div>
    </div>

    <div class="panel" style="margin-bottom:2rem;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.25rem;">
        <h2>Investment Income</h2>
        <span id="yieldFreshness" style="font-size:0.75rem;color:var(--muted);"></span>
      </div>
      <p style="font-size:0.85rem;color:var(--muted);margin-bottom:1rem;">
        Estimated annual dividends and interest by account type. The key planning number is <strong>MAGI-Relevant Investment Income</strong>, which includes taxable account income plus muni income.
        IRA, Roth, and HSA sections are shown for context only. Refresh symbol metadata from the <strong>Symbols</strong> tab when you want updated yields and prices.
      </p>
      <div id="investmentIncomeArea"></div>
    </div>

    <div class="panel" style="margin-bottom:2rem;">
      <h2>Tax Efficiency Analysis</h2>
      <div id="taxEfficiencyArea"></div>
    </div>
  </div>

  <div class="page-section" id="pageBrokerages">
    <div class="panel" style="margin-bottom:2rem;">
      <h2>Brokerage View</h2>
      <p style="font-size:0.85rem;color:var(--muted);margin-bottom:1rem;">
        Holdings imported from CSV now retain their brokerage source so you can review positions and income by custodian.
      </p>
      <div id="brokerageViewArea"></div>
    </div>
  </div>

  <div class="page-section" id="pageSymbols">
    <div class="panel" style="margin-bottom:2rem;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:0.75rem;flex-wrap:wrap;margin-bottom:1rem;">
        <h2 style="margin-bottom:0;">Symbol Catalog</h2>
        <button class="btn" id="symbolRefreshBtn" onclick="handleSymbolCatalogRefresh()">
          <span id="symbolRefreshLabel">Refresh Symbol Data</span>
        </button>
      </div>
      <p style="font-size:0.85rem;color:var(--muted);margin-bottom:1rem;">
        Persisted symbol metadata, inferred asset classes, and any stored multi-asset allocation splits.
      </p>
      <div class="planner-optional-box" style="margin-bottom:1rem;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:0.75rem;flex-wrap:wrap;margin-bottom:0.75rem;">
          <div>
            <div style="font-size:0.75rem;text-transform:uppercase;font-weight:700;letter-spacing:0.06em;color:var(--muted);">Data Source</div>
            <div style="font-size:0.92rem;">EODHD API</div>
          </div>
          <a href="https://eodhd.com/pricing" target="_blank" rel="noreferrer noopener" style="font-size:0.82rem;color:var(--blue);text-decoration:none;">Get API key</a>
        </div>
        <div class="grid-2" style="align-items:end;margin-bottom:0.5rem;">
          <label style="display:flex;flex-direction:column;gap:0.35rem;font-size:0.8rem;color:var(--muted);">
            <span>EODHD API Key</span>
            <input id="symbolApiKey" class="input" type="password" placeholder="Stored locally in this browser" autocomplete="off" />
          </label>
          <div style="display:flex;gap:0.5rem;justify-content:flex-end;align-items:end;">
            <button class="btn" onclick="clearSymbolApiSettings()">Clear</button>
            <button class="btn primary" onclick="saveSymbolApiSettings()">Save API Key</button>
          </div>
        </div>
        <div style="font-size:0.78rem;color:var(--muted);" id="symbolApiStatus">
          With a key, refresh will prefer EODHD end-of-day prices, then use the public fallback sources for name, yield, expense ratio, and classification.
        </div>
        <div style="font-size:0.78rem;color:var(--muted);margin-top:0.5rem;line-height:1.5;">
          1. Create an EODHD account and copy your API token from the dashboard.<br>
          2. Paste it here and click <strong>Save API Key</strong>. The key stays in this browser only.<br>
          3. Free EODHD access is useful for end-of-day prices. Yield and expense ratio still rely on the public fallback sources unless you add a richer fund-data provider later.
        </div>
      </div>
      <div id="symbolRefreshReportArea" style="margin-bottom:1rem;"></div>
      <div id="symbolCatalogArea"></div>
    </div>
  </div>

  <div class="page-section" id="pageHealthcare">
    <div class="panel" style="margin-bottom:2rem;">
      <h2>ACA Healthcare Subsidy Explorer</h2>
      <p style="font-size:0.85rem;color:var(--muted);margin-bottom:1.25rem;">
        See what you'd pay for ACA marketplace health insurance starting at your Retirement Phase age through Medicare at 65.
        Subsidies depend on your MAGI (Modified Adjusted Gross Income) and your age. In this retirement view, MAGI is calculated from portfolio investment income only.
      </p>

      <div style="display:flex;align-items:baseline;gap:1.5rem;flex-wrap:wrap;margin-bottom:0.5rem;">
        <div>
          <span style="font-size:0.7rem;text-transform:uppercase;font-weight:600;color:var(--muted);letter-spacing:0.04em;">MAGI</span>
          <span style="font-size:1.3rem;font-weight:700;margin-left:0.5rem;" id="hcIncomeDisplay">$40,000</span>
          <span style="font-size:0.85rem;color:var(--muted);margin-left:0.5rem;" id="hcFplDisplay">256% FPL</span>
        </div>
        <div style="font-size:0.8rem;color:var(--muted);" id="hcMagiBreakdown"></div>
      </div>

      <div id="hcCliffWarning"></div>
      <div class="hc-summary-row" id="hcSummaryRow"></div>
      <div id="hcAgeTable"></div>
    </div>

    <div class="panel" style="margin-bottom:2rem;">
      <h2>Subsidy by Income Level</h2>
      <p style="font-size:0.85rem;color:var(--muted);margin-bottom:1.25rem;">
        Compare net premiums across different income levels for a selected age. Shows the subsidy cliff at 400% FPL.
      </p>
      <div id="hcIncomeTable"></div>
    </div>

    <div class="panel" style="margin-bottom:2rem;">
      <h2>Medicare Cost Projection (Age 65+)</h2>
      <p style="font-size:0.85rem;color:var(--muted);margin-bottom:1.25rem;">
        Estimated annual healthcare costs on Medicare from age 65 to life expectancy, including premiums, services, and IRMAA surcharges.
      </p>
      <div class="hc-summary-row" id="medicareSummaryRow"></div>
      <div id="medicareTable"></div>
      <div id="medicareSources" style="margin-top:1rem;"></div>
    </div>
  </div>

  <div class="page-section" id="pageDrawdown">
    <div class="panel" style="margin-bottom:2rem;">
      <h2>Drawdown Plan</h2>
      <p style="font-size:0.85rem;color:var(--muted);margin-bottom:1.25rem;">
        This uses the same lifetime simulator as the Roth conversion calculator, but with Roth conversions disabled.
        It starts at the Retirement Phase age shown above and focuses on how the portfolio funds spending over time.
      </p>
      <div id="dpScenarioBanner"></div>

      <div class="co-controls">
        <div class="field">
          <label for="dpLifeExp">Life Expectancy</label>
          <input type="number" id="dpLifeExp" value="90" min="65" max="100">
        </div>
        <div class="field">
          <label for="dpSpending">Annual Spending Need</label>
          <input type="number" id="dpSpending" value="50000" step="1000">
        </div>
        <div class="field">
          <label for="dpSSIncome">Household Social Security</label>
          <input type="number" id="dpSSIncome" value="20000" step="1000">
        </div>
        <div class="field">
          <label for="dpTaxableReturn">Taxable Return Override (%)</label>
          <input type="number" id="dpTaxableReturn" step="0.1" placeholder="Auto">
        </div>
        <div class="field">
          <label for="dpIraReturn">IRA Return Override (%)</label>
          <input type="number" id="dpIraReturn" step="0.1" placeholder="Auto">
        </div>
        <div class="field">
          <label for="dpRothReturn">Roth Return Override (%)</label>
          <input type="number" id="dpRothReturn" step="0.1" placeholder="Auto">
        </div>
      </div>
      <div style="font-size:0.8rem;color:var(--muted);margin-bottom:0.75rem;" id="dpAssumptions"></div>
      <div id="dpResults"></div>
    </div>
  </div>

  <div class="page-section" id="pageConversion">
    <div class="panel" style="margin-bottom:2rem;">
      <h2>Roth Conversion Calculator</h2>
      <p style="font-size:0.85rem;color:var(--muted);margin-bottom:1.25rem;">
        Should you convert IRA money to Roth? This planner simulates two futures — converting vs not converting —
        and shows how much <strong>spendable after-tax money</strong> you'll have over your lifetime. No inheritance assumptions.
      </p>

      <div class="co-controls">
        <div class="field">
          <label for="coLifeExp">Life Expectancy</label>
          <input type="number" id="coLifeExp" value="90" min="65" max="100">
        </div>
        <div class="field">
          <label for="coSpending">Annual Spending Need</label>
          <input type="number" id="coSpending" value="50000" step="1000">
        </div>
        <div class="field">
          <label for="coSSIncome">Household Social Security</label>
          <input type="number" id="coSSIncome" value="20000" step="1000">
        </div>
        <div class="field">
          <label for="coStrategy">Conversion Strategy</label>
          <select id="coStrategy" style="padding:0.5rem 0.6rem;font-size:0.85rem;background:var(--bg);border:1px solid var(--border);border-radius:8px;color:var(--text);width:100%;outline:none;">
            <option value="aca_safe">Stay below ACA cliff</option>
            <option value="fill_12">Fill 12% bracket</option>
            <option value="fill_22" selected>Fill 22% bracket</option>
            <option value="maximize">Maximize spending power</option>
          </select>
        </div>
        <div class="field">
          <label for="coTaxableReturn">Taxable Return Override (%)</label>
          <input type="number" id="coTaxableReturn" step="0.1" placeholder="Auto">
        </div>
        <div class="field">
          <label for="coIraReturn">IRA Return Override (%)</label>
          <input type="number" id="coIraReturn" step="0.1" placeholder="Auto">
        </div>
        <div class="field">
          <label for="coRothReturn">Roth Return Override (%)</label>
          <input type="number" id="coRothReturn" step="0.1" placeholder="Auto">
        </div>
      </div>

      <div id="coAssumptions" style="font-size:0.8rem;color:var(--muted);margin:-0.35rem 0 1rem;"></div>

      <div id="coResults"></div>
    </div>
  </div>
</main>

<div class="modal-overlay" id="addModal">
  <div class="modal">
    <h3 id="addModalTitle">Add Holding</h3>
    <div class="field">
      <label for="hTicker">Ticker Symbol</label>
      <input type="text" id="hTicker" placeholder="e.g. VTI" style="text-transform:uppercase">
    </div>
    <div class="field">
      <label for="hName">Name</label>
      <input type="text" id="hName" placeholder="e.g. Vanguard Total Stock Market">
    </div>
    <div class="field">
      <label for="hAccount">Account</label>
      <select id="hAccount">
        <option value="roth">Roth IRA</option>
        <option value="hsa">HSA</option>
        <option value="ira">Traditional IRA</option>
        <option value="taxable">Taxable</option>
      </select>
    </div>
    <div class="field">
      <label for="hCategory">Asset Category</label>
      <select id="hCategory">
        <option value="us_stock">US Stocks</option>
        <option value="intl_stock">International Stocks</option>
        <option value="bond">Bonds</option>
        <option value="muni">Municipal Bonds (tax-exempt)</option>
        <option value="reit">REITs</option>
        <option value="cash">Cash / Money Market</option>
        <option value="crypto">Crypto</option>
        <option value="other">Other</option>
      </select>
    </div>
    <div class="field">
      <label for="hShares">Shares</label>
      <input type="number" id="hShares" step="0.001" min="0" placeholder="100">
    </div>
    <div class="field">
      <label for="hCostBasis">Cost Basis (per share)</label>
      <input type="number" id="hCostBasis" step="0.01" min="0" placeholder="150.00">
    </div>
    <div class="field">
      <label for="hPrice">Current Price (per share)</label>
      <input type="number" id="hPrice" step="0.01" min="0" placeholder="165.00">
    </div>
    <div class="field">
      <label for="hYield">Dividend Yield (%)</label>
      <input type="number" id="hYield" step="0.01" min="0" max="30" placeholder="1.5">
      <div style="font-size:0.7rem;color:var(--muted);margin-top:0.2rem;" id="hYieldHint"></div>
    </div>
    <input type="hidden" id="hEditIndex" value="-1">
    <div class="modal-actions">
      <button class="btn" onclick="closeAddModal()">Cancel</button>
      <button class="btn primary" onclick="saveHolding()">Save</button>
    </div>
  </div>
</div>

<div class="modal-overlay" id="targetModal">
  <div class="modal">
    <h3>Target Allocation</h3>
    <p style="font-size:0.85rem;color:var(--muted);margin-bottom:1.25rem;">
      Set your ideal asset allocation. Trade suggestions will be generated to rebalance toward these targets.
    </p>
    <div class="field">
      <label for="tUS">US Stocks (%)</label>
      <input type="number" id="tUS" min="0" max="100" value="50">
    </div>
    <div class="field">
      <label for="tIntl">International Stocks (%)</label>
      <input type="number" id="tIntl" min="0" max="100" value="20">
    </div>
    <div class="field">
      <label for="tBond">Bonds (%)</label>
      <input type="number" id="tBond" min="0" max="100" value="20">
    </div>
    <div class="field">
      <label for="tMuni">Municipal Bonds (%)</label>
      <input type="number" id="tMuni" min="0" max="100" value="0">
    </div>
    <div class="field">
      <label for="tREIT">REITs (%)</label>
      <input type="number" id="tREIT" min="0" max="100" value="5">
    </div>
    <div class="field">
      <label for="tCash">Cash / Money Market (%)</label>
      <input type="number" id="tCash" min="0" max="100" value="5">
    </div>
    <div class="field">
      <label for="tCrypto">Crypto (%)</label>
      <input type="number" id="tCrypto" min="0" max="100" value="0">
    </div>
    <div class="field">
      <label for="tOther">Other (%)</label>
      <input type="number" id="tOther" min="0" max="100" value="0">
    </div>
    <div id="targetSum" style="font-size:0.85rem;font-weight:600;margin-bottom:0.5rem;"></div>
    <div class="modal-actions">
      <button class="btn" onclick="closeTargetModal()">Cancel</button>
      <button class="btn primary" onclick="saveTargets()">Save Targets</button>
    </div>
  </div>
</div>

<div class="modal-overlay" id="importModal">
  <div class="modal wide">
    <h3>Import Holdings from CSV</h3>

    <div id="importStep1">
      <div class="drop-zone" id="dropZone">
        <p>Drop a CSV file here, or click to browse</p>
        <div class="drop-hint">Supports exports from Fidelity, Schwab, Vanguard, E*TRADE, and generic CSV</div>
        <input type="file" id="csvFileInput" accept=".csv,.txt" style="display:none">
      </div>

      <details style="font-size:0.78rem;color:var(--muted);margin-bottom:0.75rem;cursor:pointer;">
        <summary style="font-weight:600;margin-bottom:0.4rem;">How to export from your brokerage</summary>
        <div style="padding:0.5rem 0.75rem;background:var(--bg);border-radius:8px;border:1px solid var(--border);line-height:1.7;">
          <strong style="color:var(--text);">Fidelity:</strong> Positions page → Download → CSV. Includes all accounts.<br>
          <strong style="color:var(--text);">Schwab:</strong> Positions page → Export → CSV. One file per account — import each separately and set the account type.<br>
          <strong style="color:var(--text);">Vanguard:</strong> Holdings → Download → CSV/Spreadsheet. Note: standard export omits cost basis — download separately via Holdings → Show: cost basis.<br>
          <strong style="color:var(--text);">E*TRADE:</strong> Portfolio → Download → Comma-delimited (CSV).<br>
          <strong style="color:var(--text);">Other:</strong> Any CSV with columns for ticker, shares, and price will work. You can map columns manually after upload.
          <div style="margin-top:0.4rem;color:var(--accent);font-weight:600;">Import once per brokerage — duplicates are merged automatically.</div>
        </div>
      </details>

      <div style="font-size:0.8rem;color:var(--muted);margin-bottom:0.75rem;">
        Or paste CSV content directly:
      </div>
      <textarea id="csvPasteArea" rows="4" placeholder="Symbol,Description,Quantity,Last Price,Cost Basis Total..." style="width:100%;padding:0.6rem 0.75rem;background:var(--bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:0.85rem;font-family:monospace;resize:vertical;outline:none;margin-bottom:1rem;"></textarea>

      <div class="modal-actions">
        <button class="btn" onclick="closeImportModal()">Cancel</button>
        <button class="btn primary" onclick="parseCsvInput()">Parse</button>
      </div>
    </div>

    <div id="importStep2" style="display:none;">
      <div style="font-size:0.85rem;color:var(--muted);margin-bottom:0.75rem;">
        Select a preset or manually map your CSV columns.
      </div>

      <div class="preset-btns" id="presetBtns"></div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem 1rem;margin-bottom:1rem;">
        <div class="field">
          <label for="mapTicker">Ticker / Symbol</label>
          <select id="mapTicker"></select>
        </div>
        <div class="field">
          <label for="mapName">Name / Description</label>
          <select id="mapName"></select>
        </div>
        <div class="field">
          <label for="mapShares">Shares / Quantity</label>
          <select id="mapShares"></select>
        </div>
        <div class="field">
          <label for="mapPrice">Current Price</label>
          <select id="mapPrice"></select>
        </div>
        <div class="field">
          <label for="mapCostBasis">Cost Basis (per share)</label>
          <select id="mapCostBasis"></select>
        </div>
        <div class="field">
          <label for="mapCostTotal">Cost Basis (total) — used if per-share is empty</label>
          <select id="mapCostTotal"></select>
        </div>
        <div class="field">
          <label for="mapValue">Market Value (optional)</label>
          <select id="mapValue"></select>
        </div>
        <div class="field">
          <label for="mapAccount">Account (optional column)</label>
          <select id="mapAccount"></select>
        </div>
      </div>

      <div id="acctMappingArea">
        <div class="field">
          <label for="importAcctDefault">Default account type for all rows</label>
          <select id="importAcctDefault">
            <option value="roth">Roth IRA</option>
            <option value="hsa">HSA</option>
            <option value="ira">Traditional IRA</option>
            <option value="taxable">Taxable</option>
          </select>
        </div>
      </div>

      <div style="font-size:0.8rem;font-weight:600;color:var(--muted);margin:1rem 0 0.5rem;text-transform:uppercase;letter-spacing:0.04em;">Preview (first 10 rows)</div>
      <div style="overflow-x:auto;">
        <table class="csv-preview-table" id="csvPreviewTable"></table>
      </div>

      <div class="import-summary" id="importSummary"></div>

      <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.5rem;">
        <label style="font-size:0.85rem;display:flex;align-items:center;gap:0.4rem;cursor:pointer;">
          <input type="checkbox" id="importReplace"> Replace all existing holdings (instead of appending)
        </label>
      </div>

      <div class="modal-actions">
        <button class="btn" onclick="importGoBack()">Back</button>
        <button class="btn" onclick="closeImportModal()">Cancel</button>
        <button class="btn primary" onclick="executeImport()">Import</button>
      </div>
    </div>
  </div>
</div>

<div class="modal-overlay" id="costBasisModal">
  <div class="modal" style="max-width:700px;">
    <div class="modal-header">
      <h3>Import Cost Basis (Vanguard)</h3>
      <button class="modal-close" onclick="closeCostBasisModal()">&times;</button>
    </div>
    <div class="modal-body">
      <div style="font-size:0.85rem;color:var(--muted);margin-bottom:1rem;">
        <strong>Vanguard:</strong> Go to <em>Cost Basis</em> page → <em>Cost Basis Export</em> → select account → choose <em>Unrealized</em> → Export.<br>
        This will merge cost basis into your existing holdings by matching ticker symbols.
      </div>
      <div style="margin-bottom:1rem;">
        <div class="drop-zone" id="cbDropZone" style="border:2px dashed var(--border);border-radius:10px;padding:2rem;text-align:center;cursor:pointer;">
          <p>Drop cost basis CSV here, or click to browse</p>
          <input type="file" id="cbFileInput" accept=".csv,.txt" style="display:none">
        </div>
      </div>
      <div style="margin-bottom:0.75rem;">Or paste CSV content:</div>
      <textarea id="cbPasteArea" rows="4" placeholder="Account,Symbol/CUSIP,Description,Acquired date,Cost basis method,Quantity,Cost per share,Total cost,..." style="width:100%;padding:0.6rem 0.75rem;background:var(--bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:0.85rem;font-family:monospace;resize:vertical;outline:none;margin-bottom:1rem;"></textarea>
      <div id="cbPreview" style="display:none;"></div>
      <div class="modal-actions" style="display:flex;gap:0.5rem;justify-content:flex-end;">
        <button class="btn" onclick="closeCostBasisModal()">Cancel</button>
        <button class="btn" onclick="parseCostBasisInput()">Parse</button>
        <button class="btn primary" id="cbImportBtn" onclick="executeCostBasisImport()" style="display:none;">Apply Cost Basis</button>
      </div>
    </div>
  </div>
</div>
`;

const app = document.getElementById('app');
if (!app) {
  throw new Error('Missing #app mount point');
}
app.innerHTML = APP_HTML;

type CsvRow = string[];
type CostBasisAggregate = {
  ticker: string;
  name: string;
  totalShares: number;
  totalCost: number;
  stGain: number;
  ltGain: number;
  totalGain: number;
  lots: number;
};

const win = window as any;
const SA_API = 'https://api.stockanalysis.com/api/symbol';
const DEALCHARTS_SEARCH_API = 'https://dealcharts.org/.netlify/functions/search';
const EODHD_API = 'https://eodhd.com/api';
const SYMBOL_API_KEY_STORAGE_KEY = 'fire_eodhd_api_key';
const SYMBOL_REFRESH_REPORT_STORAGE_KEY = 'fire_symbol_refresh_report';

let csvHeaders: string[] = [];
let csvRows: CsvRow[] = [];
let csvExcluded = new Set<number>();
let cbParsedRows: CostBasisAggregate[] = [];
let acctMap: Record<string, AccountType> = {};
const plannerInputIds = [
  'currentAge',
  'filingStatus',
  'householdSize',
  'spouseAge',
  'spouseAnnualIncome',
  'spouseRetirementAge',
  'annualIncome',
  'annualExpenses',
  'currentSavings',
  'returnRate',
  'inflationRate',
  'withdrawalRate',
  'taxRate',
  'retireExpenses',
  'longevityAge',
  'socialSecurityClaimAge',
  'socialSecurityBenefit',
  'spouseSocialSecurityClaimAge',
  'spouseSocialSecurityBenefit',
] as const;
const drawdownInputIds = [
  'dpLifeExp',
  'dpSpending',
  'dpSSIncome',
  'dpTaxableReturn',
  'dpIraReturn',
  'dpRothReturn',
] as const;
const PLANNER_INPUTS_STORAGE_KEY = 'fire_planner_inputs';
const DRAWDOWN_INPUTS_STORAGE_KEY = 'fire_drawdown_inputs';
const PLANNING_SCENARIOS_STORAGE_KEY = 'fire_planning_scenarios';
const ACTIVE_DRAWDOWN_SCENARIO_STORAGE_KEY = 'fire_active_drawdown_scenario_id';

type PlannerInputSnapshot = Record<(typeof plannerInputIds)[number], string> & {
  taxRateAuto: boolean;
  retireExpensesCustom: boolean;
};

type DrawdownInputSnapshot = Record<(typeof drawdownInputIds)[number], string>;

type PlanningScenario = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  plannerInputs: PlannerInputSnapshot;
  retirementAge: string;
  drawdownInputs: DrawdownInputSnapshot;
};

let activeBrokerageFilter = 'all';
let editingSymbolTicker: string | null = null;
let currentImportBrokerage: string | null = null;
let tickerFetchTimer: number | null = null;
let plannerRetireExpensesCustom = false;
let lastAutoHouseholdSs = 20000;
let symbolApiKey = localStorage.getItem(SYMBOL_API_KEY_STORAGE_KEY) || '';
let activeDrawdownScenarioId = localStorage.getItem(ACTIVE_DRAWDOWN_SCENARIO_STORAGE_KEY);
type SymbolRefreshSuccess = {
  ticker: string;
  fields: string[];
  sources: string[];
};
type SymbolRefreshFailure = {
  ticker: string;
  apiCalls: string[];
  missingFields: string[];
};
type SymbolRefreshReport = {
  startedAt: number;
  completedAt: number;
  total: number;
  updated: number;
  failed: number;
  successes: SymbolRefreshSuccess[];
  failures: SymbolRefreshFailure[];
};

function normalizeStoredRefreshReport(raw: string): SymbolRefreshReport | null {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      startedAt: Number(parsed.startedAt) || Date.now(),
      completedAt: Number(parsed.completedAt) || Date.now(),
      total: Number(parsed.total) || 0,
      updated: Number(parsed.updated) || 0,
      failed: Number(parsed.failed) || 0,
      successes: Array.isArray(parsed.successes)
        ? parsed.successes.map((item: any) => ({
            ticker: String(item.ticker || ''),
            fields: Array.isArray(item.fields) ? item.fields.map(String) : [],
            sources: Array.isArray(item.sources) ? item.sources.map(String) : [],
          }))
        : [],
      failures: Array.isArray(parsed.failures)
        ? parsed.failures.map((item: any) => ({
            ticker: String(item.ticker || ''),
            apiCalls: Array.isArray(item.apiCalls)
              ? item.apiCalls.map(String)
              : item.error ? [String(item.error)] : [],
            missingFields: Array.isArray(item.missingFields) ? item.missingFields.map(String) : [],
          }))
        : [],
    };
  } catch {
    return null;
  }
}

let lastRefreshReport: SymbolRefreshReport | null = (() => {
  const raw = localStorage.getItem(SYMBOL_REFRESH_REPORT_STORAGE_KEY);
  if (!raw) return null;
  return normalizeStoredRefreshReport(raw);
})();

function createScenarioId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `scenario-${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
}

function emptyPlannerInputSnapshot(): PlannerInputSnapshot {
  return {
    currentAge: '30',
    filingStatus: 'single',
    householdSize: '1',
    spouseAge: '30',
    spouseAnnualIncome: '0',
    spouseRetirementAge: '67',
    annualIncome: '100000',
    annualExpenses: '40000',
    currentSavings: '50000',
    returnRate: '7',
    inflationRate: '3',
    withdrawalRate: '4',
    taxRate: '25',
    retireExpenses: '40000',
    longevityAge: '95',
    socialSecurityClaimAge: '67',
    socialSecurityBenefit: '0',
    spouseSocialSecurityClaimAge: '67',
    spouseSocialSecurityBenefit: '0',
    taxRateAuto: true,
    retireExpensesCustom: false,
  };
}

function emptyDrawdownInputSnapshot(): DrawdownInputSnapshot {
  return {
    dpLifeExp: '90',
    dpSpending: '50000',
    dpSSIncome: '20000',
    dpTaxableReturn: '',
    dpIraReturn: '',
    dpRothReturn: '',
  };
}

function normalizePlanningScenario(raw: unknown): PlanningScenario | null {
  if (!raw || typeof raw !== 'object') return null;
  const scenario = raw as Record<string, any>;
  const plannerDefaults = emptyPlannerInputSnapshot();
  const drawdownDefaults = emptyDrawdownInputSnapshot();
  const plannerInputs = { ...plannerDefaults };
  const drawdownInputs = { ...drawdownDefaults };

  for (const id of plannerInputIds) {
    if (scenario.plannerInputs?.[id] != null) plannerInputs[id] = String(scenario.plannerInputs[id]);
  }
  if (typeof scenario.plannerInputs?.taxRateAuto === 'boolean') plannerInputs.taxRateAuto = scenario.plannerInputs.taxRateAuto;
  if (typeof scenario.plannerInputs?.retireExpensesCustom === 'boolean') plannerInputs.retireExpensesCustom = scenario.plannerInputs.retireExpensesCustom;
  for (const id of drawdownInputIds) {
    if (scenario.drawdownInputs?.[id] != null) drawdownInputs[id] = String(scenario.drawdownInputs[id]);
  }

  const id = typeof scenario.id === 'string' && scenario.id.trim() ? scenario.id.trim() : createScenarioId();
  const name = typeof scenario.name === 'string' && scenario.name.trim() ? scenario.name.trim() : 'Untitled Scenario';
  const createdAt = Number(scenario.createdAt) || Date.now();
  const updatedAt = Number(scenario.updatedAt) || createdAt;

  return {
    id,
    name,
    createdAt,
    updatedAt,
    plannerInputs,
    retirementAge: scenario.retirementAge != null ? String(scenario.retirementAge) : '55',
    drawdownInputs,
  };
}

function loadPlanningScenarios(): PlanningScenario[] {
  const raw = localStorage.getItem(PLANNING_SCENARIOS_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizePlanningScenario)
      .filter((scenario): scenario is PlanningScenario => scenario !== null)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

let planningScenarios = loadPlanningScenarios();

function syncGlobalRefs(): void {
  win.acctMap = acctMap;
}

syncGlobalRefs();

function readInt(id: string, fallback = 0): number {
  const value = parseInt($(id).value, 10);
  return Number.isFinite(value) ? value : fallback;
}

function readFloat(id: string, fallback = 0): number {
  const value = parseFloat($(id).value);
  return Number.isFinite(value) ? value : fallback;
}

function readOptionalFloat(id: string): number | null {
  const raw = $(id).value.trim();
  if (!raw) return null;
  const value = parseFloat(raw);
  return Number.isFinite(value) ? value : null;
}

function readFilingStatus(): FilingStatus {
  return $('filingStatus').value === 'married' ? 'married' : 'single';
}

function readHouseholdSize(): number {
  const minimum = readFilingStatus() === 'married' ? 2 : 1;
  return Math.max(readInt('householdSize', minimum), minimum);
}

function getPlannerHouseholdProfile() {
  const filingStatus = readFilingStatus();
  const currentAge = readInt('currentAge', 30);
  const spouseAge = filingStatus === 'married' ? readInt('spouseAge', currentAge) : currentAge;
  return {
    filingStatus,
    currentAge,
    spouseAge,
    householdSize: readHouseholdSize(),
    spouseRetirementAge: filingStatus === 'married' ? readInt('spouseRetirementAge', spouseAge) : 0,
    spouseAnnualIncome: filingStatus === 'married' ? readFloat('spouseAnnualIncome', 0) : 0,
    socialSecurityBenefit: readFloat('socialSecurityBenefit', 0),
    spouseSocialSecurityBenefit: filingStatus === 'married' ? readFloat('spouseSocialSecurityBenefit', 0) : 0,
  };
}

function syncHouseholdDefaults(force = false): void {
  const profile = getPlannerHouseholdProfile();
  const combinedHouseholdSs = profile.socialSecurityBenefit + profile.spouseSocialSecurityBenefit;
  const dpInput = $('dpSSIncome') as HTMLInputElement;
  const coInput = $('coSSIncome') as HTMLInputElement;

  if (force || Number(dpInput.value) === lastAutoHouseholdSs) dpInput.value = String(combinedHouseholdSs);
  if (force || Number(coInput.value) === lastAutoHouseholdSs) coInput.value = String(combinedHouseholdSs);
  lastAutoHouseholdSs = combinedHouseholdSs;
}

function updatePlannerHouseholdVisibility(): void {
  const showSpouseFields = readFilingStatus() === 'married' && readHouseholdSize() > 1;
  $('plannerSpouseInfoRow').style.display = showSpouseFields ? '' : 'none';
  $('plannerSpouseSocialSecurityRow').style.display = showSpouseFields ? '' : 'none';
}

function syncRetireExpensesFromCurrent(): void {
  if (plannerRetireExpensesCustom) return;
  $('retireExpenses').value = $('annualExpenses').value;
}

function attachGlobals(): void {
  Object.assign(win, {
    exportBackup,
    importBackup,
    loadDemoPortfolio,
    resetAllData: loadDemoPortfolio,
    switchPage,
    openImportModal,
    closeImportModal,
    importGoBack,
    parseCsvInput,
    executeImport,
    toggleCsvRow,
    updateCsvPreview,
    openCostBasisModal,
    closeCostBasisModal,
    parseCostBasisInput,
    executeCostBasisImport,
    openAddModal,
    closeAddModal,
    saveHolding,
    openTargetModal,
    closeTargetModal,
    saveTargets,
    handleSymbolCatalogRefresh,
    setBrokerageFilter,
    startSymbolEdit,
    cancelSymbolEdit,
    saveSymbolEdit,
    saveSymbolApiSettings,
    clearSymbolApiSettings,
    clearSymbolRefreshReport,
    saveCurrentScenario,
    loadPlanningScenario,
    useScenarioForDrawdown,
    deletePlanningScenario,
  });
}

function renderPortfolio(): void {
  renderSummary();
  renderHoldings();
  renderAllocation();
  renderSuggestions();
  renderAccountBreakdown();
  renderInvestmentIncome();
  renderTaxEfficiency();
}

function readPlannerInputs() {
  return {
    currentAge: readInt('currentAge', 30),
    filingStatus: readFilingStatus(),
    householdSize: readHouseholdSize(),
    spouseAge: readInt('spouseAge', readInt('currentAge', 30)),
    spouseAnnualIncome: readFloat('spouseAnnualIncome', 0),
    spouseRetirementAge: readInt('spouseRetirementAge', readInt('spouseAge', readInt('currentAge', 30))),
    annualIncome: readFloat('annualIncome', 100000),
    annualExpenses: readFloat('annualExpenses', 40000),
    currentSavings: readFloat('currentSavings', 50000),
    returnRate: readFloat('returnRate', 7),
    inflationRate: readFloat('inflationRate', 3),
    withdrawalRate: readFloat('withdrawalRate', 4),
    taxRate: (document.getElementById('taxRateAuto') as HTMLInputElement | null)?.checked ? null : readOptionalFloat('taxRate'),
    retireExpenses: readFloat('retireExpenses', 35000),
    longevityAge: readInt('longevityAge', 95),
    socialSecurityClaimAge: readInt('socialSecurityClaimAge', 67),
    socialSecurityBenefit: readFloat('socialSecurityBenefit', 0),
    spouseSocialSecurityClaimAge: readInt('spouseSocialSecurityClaimAge', 67),
    spouseSocialSecurityBenefit: readFloat('spouseSocialSecurityBenefit', 0),
  };
}

function readPlannerInputSnapshot(): PlannerInputSnapshot {
  const payload = plannerInputIds.reduce<Record<string, string>>((acc, id) => {
    acc[id] = $(id).value;
    return acc;
  }, {}) as Record<(typeof plannerInputIds)[number], string>;
  return {
    ...payload,
    taxRateAuto: (document.getElementById('taxRateAuto') as HTMLInputElement | null)?.checked ?? true,
    retireExpensesCustom: plannerRetireExpensesCustom,
  };
}

function applyPlannerInputSnapshot(snapshot: Partial<PlannerInputSnapshot>): void {
  for (const id of plannerInputIds) {
    const value = snapshot[id];
    if (value != null) $(id).value = String(value);
  }
  if (typeof snapshot.taxRateAuto === 'boolean') $('taxRateAuto').checked = snapshot.taxRateAuto;
  if (typeof snapshot.retireExpensesCustom === 'boolean') plannerRetireExpensesCustom = snapshot.retireExpensesCustom;
}

function readDrawdownInputSnapshot(): DrawdownInputSnapshot {
  return drawdownInputIds.reduce<Record<string, string>>((acc, id) => {
    acc[id] = $(id).value;
    return acc;
  }, {}) as DrawdownInputSnapshot;
}

function applyDrawdownInputSnapshot(snapshot: Partial<DrawdownInputSnapshot>): void {
  for (const id of drawdownInputIds) {
    const value = snapshot[id];
    if (value != null) $(id).value = String(value);
  }
}

function persistPlannerInputs(): void {
  localStorage.setItem(PLANNER_INPUTS_STORAGE_KEY, JSON.stringify(readPlannerInputSnapshot()));
}

function persistDrawdownInputs(): void {
  localStorage.setItem(DRAWDOWN_INPUTS_STORAGE_KEY, JSON.stringify(readDrawdownInputSnapshot()));
}

function persistPlanningScenarios(): void {
  localStorage.setItem(PLANNING_SCENARIOS_STORAGE_KEY, JSON.stringify(planningScenarios));
  if (activeDrawdownScenarioId && !planningScenarios.some((scenario) => scenario.id === activeDrawdownScenarioId)) {
    activeDrawdownScenarioId = null;
    localStorage.removeItem(ACTIVE_DRAWDOWN_SCENARIO_STORAGE_KEY);
  }
}

function setActiveDrawdownScenario(id: string | null): void {
  activeDrawdownScenarioId = id;
  if (id) localStorage.setItem(ACTIVE_DRAWDOWN_SCENARIO_STORAGE_KEY, id);
  else localStorage.removeItem(ACTIVE_DRAWDOWN_SCENARIO_STORAGE_KEY);
}

function getActiveDrawdownScenario(): PlanningScenario | null {
  if (!activeDrawdownScenarioId) return null;
  const scenario = planningScenarios.find((item) => item.id === activeDrawdownScenarioId) || null;
  if (!scenario) setActiveDrawdownScenario(null);
  return scenario;
}

function clearActiveDrawdownScenario(): void {
  if (!activeDrawdownScenarioId) return;
  setActiveDrawdownScenario(null);
}

function getPlannerResult() {
  return calculateFirePlan(readPlannerInputs());
}

function getDefaultRetirementAge(): number {
  const plannerResult = getPlannerResult();
  return plannerResult.fireAge ?? readInt('currentAge', 50);
}

function setRetirementAgeAutoUpdated(isAutoUpdated: boolean): void {
  const tag = document.getElementById('retirementAgeAutoTag');
  if (!tag) return;
  tag.classList.toggle('is-visible', isAutoUpdated);
}

function syncRetirementAgeDefault(): void {
  const input = document.getElementById('retirementAge') as HTMLInputElement | null;
  if (!input) return;

  const defaultAge = getDefaultRetirementAge();
  input.value = String(defaultAge);
  localStorage.setItem('fire_retirement_age', String(defaultAge));
  setRetirementAgeAutoUpdated(true);
}

function readRetirementAge(): number {
  return readInt('retirementAge', getDefaultRetirementAge());
}

function hydratePlannerInputs(): void {
  const saved = localStorage.getItem(PLANNER_INPUTS_STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved) as Partial<PlannerInputSnapshot>;
      applyPlannerInputSnapshot(parsed);
      if (typeof parsed.retireExpensesCustom !== 'boolean' && parsed.retireExpenses != null) {
        plannerRetireExpensesCustom = true;
      }
    } catch {
      // Ignore malformed planner state.
    }
  } else {
    const savedAge = localStorage.getItem('fire_user_age');
    if (savedAge) $('currentAge').value = savedAge;
    plannerRetireExpensesCustom = false;
    syncRetireExpensesFromCurrent();
  }
  syncHouseholdDefaults(true);
}

function hydrateDrawdownInputs(): void {
  const saved = localStorage.getItem(DRAWDOWN_INPUTS_STORAGE_KEY);
  if (!saved) return;
  try {
    const parsed = JSON.parse(saved) as Partial<DrawdownInputSnapshot>;
    applyDrawdownInputSnapshot(parsed);
  } catch {
    // Ignore malformed drawdown state.
  }
}

function updatePlannerTaxControls(): void {
  const autoInput = document.getElementById('taxRateAuto') as HTMLInputElement | null;
  const taxInput = document.getElementById('taxRate') as HTMLInputElement | null;
  const hint = document.getElementById('taxRateHint');
  if (!autoInput || !taxInput || !hint) return;

  const inputs = readPlannerInputs();
  const grossIncome = inputs.annualIncome + (inputs.filingStatus === 'married' ? inputs.spouseAnnualIncome || 0 : 0);
  const autoRate = calculateFirePlan(inputs).currentEffectiveTaxRate;
  taxInput.disabled = autoInput.checked;
  hint.textContent = autoInput.checked
    ? `Auto: ${autoRate.toFixed(1)}% effective tax from the ${TAX_PLANNING_BASELINE_LABEL} federal income tax plus employee Social Security and Medicare`
    : `Override: use your own all-in effective tax rate instead of the automatic ${TAX_PLANNING_BASELINE_LABEL} federal and payroll estimate`;
}

function readScenarioInt(snapshot: Record<string, string | boolean>, key: string, fallback: number): number {
  const raw = snapshot[key];
  const value = typeof raw === 'string' ? parseInt(raw, 10) : NaN;
  return Number.isFinite(value) ? value : fallback;
}

function readScenarioFloat(snapshot: Record<string, string | boolean>, key: string, fallback: number): number {
  const raw = snapshot[key];
  const value = typeof raw === 'string' ? parseFloat(raw) : NaN;
  return Number.isFinite(value) ? value : fallback;
}

function calculateScenarioPlan(scenario: PlanningScenario) {
  return calculateFirePlan({
    currentAge: readScenarioInt(scenario.plannerInputs, 'currentAge', 30),
    filingStatus: scenario.plannerInputs.filingStatus === 'married' ? 'married' : 'single',
    householdSize: readScenarioInt(scenario.plannerInputs, 'householdSize', 1),
    spouseAge: readScenarioInt(scenario.plannerInputs, 'spouseAge', readScenarioInt(scenario.plannerInputs, 'currentAge', 30)),
    spouseAnnualIncome: readScenarioFloat(scenario.plannerInputs, 'spouseAnnualIncome', 0),
    spouseRetirementAge: readScenarioInt(scenario.plannerInputs, 'spouseRetirementAge', readScenarioInt(scenario.plannerInputs, 'spouseAge', 30)),
    annualIncome: readScenarioFloat(scenario.plannerInputs, 'annualIncome', 100000),
    annualExpenses: readScenarioFloat(scenario.plannerInputs, 'annualExpenses', 40000),
    currentSavings: readScenarioFloat(scenario.plannerInputs, 'currentSavings', 50000),
    returnRate: readScenarioFloat(scenario.plannerInputs, 'returnRate', 7),
    inflationRate: readScenarioFloat(scenario.plannerInputs, 'inflationRate', 3),
    withdrawalRate: readScenarioFloat(scenario.plannerInputs, 'withdrawalRate', 4),
    taxRate: scenario.plannerInputs.taxRateAuto ? null : readScenarioFloat(scenario.plannerInputs, 'taxRate', 25),
    retireExpenses: readScenarioFloat(scenario.plannerInputs, 'retireExpenses', 40000),
    longevityAge: readScenarioInt(scenario.plannerInputs, 'longevityAge', 95),
    socialSecurityClaimAge: readScenarioInt(scenario.plannerInputs, 'socialSecurityClaimAge', 67),
    socialSecurityBenefit: readScenarioFloat(scenario.plannerInputs, 'socialSecurityBenefit', 0),
    spouseSocialSecurityClaimAge: readScenarioInt(scenario.plannerInputs, 'spouseSocialSecurityClaimAge', 67),
    spouseSocialSecurityBenefit: readScenarioFloat(scenario.plannerInputs, 'spouseSocialSecurityBenefit', 0),
  });
}

function renderDrawdownScenarioBanner(): void {
  const area = document.getElementById('dpScenarioBanner');
  if (!area) return;
  const activeScenario = getActiveDrawdownScenario();
  if (activeScenario) {
    area.innerHTML = `
      <div class="planner-scenario-banner active">
        <strong>Using saved scenario:</strong> ${esc(activeScenario.name)}.
        Editing planner, retirement-age, or drawdown inputs switches this page back to the current draft.
      </div>`;
    return;
  }
  area.innerHTML = planningScenarios.length > 0
    ? '<div class="planner-scenario-banner">Drawdown is currently using the current working draft. Pick a saved scenario on the Retirement Age Calculator page if you want to lock one in here.</div>'
    : '';
}

function renderScenarioManager(): void {
  const area = document.getElementById('plannerScenarioManager');
  if (!area) return;

  if (planningScenarios.length === 0) {
    area.innerHTML = `
      <div class="planner-scenario-empty">
        <div class="planner-scenario-empty-title">No saved scenarios yet</div>
        <div class="planner-hint">Save the current planner and drawdown inputs as your first scenario, then pick one to drive the drawdown page.</div>
      </div>`;
    return;
  }

  const activeId = getActiveDrawdownScenario()?.id || null;
  area.innerHTML = `
    <div class="planner-scenario-list">
      ${planningScenarios.map((scenario) => {
        const plan = calculateScenarioPlan(scenario);
        const retirementAge = Number(scenario.retirementAge) || plan.fireAge || readScenarioInt(scenario.plannerInputs, 'currentAge', 30);
        const spending = readScenarioFloat(scenario.drawdownInputs, 'dpSpending', 50000);
        const lifeExp = readScenarioInt(scenario.drawdownInputs, 'dpLifeExp', 90);
        const ssIncome = readScenarioFloat(scenario.drawdownInputs, 'dpSSIncome', 0);
        const isActive = scenario.id === activeId;
        const dateLabel = new Date(scenario.updatedAt).toLocaleDateString();
        const readinessLabel = plan.fireAge !== null && retirementAge >= plan.fireAge
          ? 'Retirement age is funded'
          : plan.fireAge !== null
            ? `Planner reaches FIRE at ${plan.fireAge}`
            : 'Planner never reaches FIRE';
        return `
          <div class="planner-scenario-card${isActive ? ' is-active' : ''}">
            <div class="planner-scenario-head">
              <div>
                <div class="planner-scenario-name">${esc(scenario.name)}</div>
                <div class="planner-scenario-meta">Updated ${dateLabel}${isActive ? ' • Active on drawdown' : ''}</div>
              </div>
              ${isActive ? '<div class="planner-scenario-badge">Drawdown</div>' : ''}
            </div>
            <div class="planner-scenario-grid">
              <div><span>FIRE age</span><strong>${plan.fireAge ?? 'Not reached'}</strong></div>
              <div><span>Retire at</span><strong>${retirementAge}</strong></div>
              <div><span>Spending</span><strong>$${fmtK(spending)}/yr</strong></div>
              <div><span>Life expectancy</span><strong>${lifeExp}</strong></div>
              <div><span>Household SS</span><strong>${ssIncome > 0 ? `$${fmtK(ssIncome)}/yr` : 'Off'}</strong></div>
              <div><span>Status</span><strong>${readinessLabel}</strong></div>
            </div>
            <div class="planner-scenario-actions">
              <button class="btn" onclick="loadPlanningScenario('${scenario.id}')">Load</button>
              <button class="btn primary" onclick="useScenarioForDrawdown('${scenario.id}')">${isActive ? 'Using for Drawdown' : 'Use for Drawdown'}</button>
              <button class="btn danger" onclick="deletePlanningScenario('${scenario.id}')">Delete</button>
            </div>
          </div>`;
      }).join('')}
    </div>`;
}

function captureCurrentScenario(name: string, existing?: PlanningScenario): PlanningScenario {
  const now = Date.now();
  return {
    id: existing?.id || createScenarioId(),
    name,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    plannerInputs: readPlannerInputSnapshot(),
    retirementAge: $('retirementAge').value,
    drawdownInputs: readDrawdownInputSnapshot(),
  };
}

function applyScenario(scenario: PlanningScenario, setActive = false): void {
  applyPlannerInputSnapshot(scenario.plannerInputs);
  $('retirementAge').value = scenario.retirementAge;
  applyDrawdownInputSnapshot(scenario.drawdownInputs);
  if (scenario.plannerInputs.currentAge) localStorage.setItem('fire_user_age', scenario.plannerInputs.currentAge);
  localStorage.setItem('fire_retirement_age', scenario.retirementAge);
  updatePlannerHouseholdVisibility();
  syncRetireExpensesFromCurrent();
  syncHouseholdDefaults(true);
  updatePlannerTaxControls();
  persistPlannerInputs();
  persistDrawdownInputs();
  setRetirementAgeAutoUpdated(false);
  setActiveDrawdownScenario(setActive ? scenario.id : null);
  renderAll(false);
}

function saveCurrentScenario(): void {
  const defaultName = `Scenario ${planningScenarios.length + 1}`;
  const name = window.prompt('Save current planner and drawdown inputs as scenario:', defaultName)?.trim();
  if (!name) return;

  const existing = planningScenarios.find((scenario) => scenario.name.toLowerCase() === name.toLowerCase());
  if (existing && !window.confirm(`Replace the existing scenario named "${existing.name}"?`)) return;

  const nextScenario = captureCurrentScenario(name, existing);
  planningScenarios = existing
    ? planningScenarios.map((scenario) => scenario.id === existing.id ? nextScenario : scenario)
    : [nextScenario, ...planningScenarios];
  planningScenarios.sort((a, b) => b.updatedAt - a.updatedAt);
  persistPlanningScenarios();
  renderScenarioManager();
  renderDrawdownScenarioBanner();
}

function loadPlanningScenario(id: string): void {
  const scenario = planningScenarios.find((item) => item.id === id);
  if (!scenario) return;
  applyScenario(scenario, false);
}

function useScenarioForDrawdown(id: string): void {
  const scenario = planningScenarios.find((item) => item.id === id);
  if (!scenario) return;
  applyScenario(scenario, true);
}

function deletePlanningScenario(id: string): void {
  const scenario = planningScenarios.find((item) => item.id === id);
  if (!scenario) return;
  if (!window.confirm(`Delete the scenario "${scenario.name}"?`)) return;
  planningScenarios = planningScenarios.filter((item) => item.id !== id);
  if (activeDrawdownScenarioId === id) setActiveDrawdownScenario(null);
  persistPlanningScenarios();
  renderScenarioManager();
  renderDrawdownScenarioBanner();
}

function renderPlanner(forceChart = false, syncRetirementAge = true): void {
  const result = getPlannerResult();
  if (syncRetirementAge) syncRetirementAgeDefault();
  renderPlannerPage(result, forceChart || $('pagePlanner').classList.contains('active'));
  renderScenarioManager();
}

function renderRetirementPhase(): void {
  renderPortfolio();
  renderBrokerages();
  renderSymbols();
  renderDrawdownPlan();
  renderConversionOptimizer();
  renderHealthcare();
}

function renderBrokerages(): void {
  renderBrokeragePage(activeBrokerageFilter);
}

function renderSymbols(): void {
  const apiKeyInput = document.getElementById('symbolApiKey') as HTMLInputElement | null;
  if (apiKeyInput) apiKeyInput.value = symbolApiKey;
  const apiStatus = document.getElementById('symbolApiStatus');
  if (apiStatus) {
    apiStatus.textContent = symbolApiKey
      ? 'API key saved locally. Refreshes will prefer EODHD end-of-day prices before using the public fallback sources for the remaining fields.'
      : 'Add an EODHD API key if you want end-of-day price refreshes for mutual funds. Without a key, refresh uses the public fallback sources only.';
  }
  renderSymbolCatalogPage({ editingTicker: editingSymbolTicker });
  renderSymbolRefreshReport();
}

function renderAll(syncRetirementAge = true): void {
  renderPlanner(false, syncRetirementAge);
  renderRetirementPhase();
}

function setBrokerageFilter(brokerage: string): void {
  activeBrokerageFilter = brokerage;
  renderBrokerages();
}

function renderSymbolRefreshReport(): void {
  const area = document.getElementById('symbolRefreshReportArea');
  if (!area) return;
  if (!lastRefreshReport) {
    area.innerHTML = '';
    return;
  }

  const completed = new Date(lastRefreshReport.completedAt).toLocaleString();
  area.innerHTML = `
    <div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:1rem 1.25rem;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap;margin-bottom:0.75rem;">
        <div>
          <div style="font-size:0.75rem;text-transform:uppercase;font-weight:600;color:var(--muted);letter-spacing:0.04em;margin-bottom:0.2rem;">Last Refresh</div>
          <div style="font-size:0.9rem;">${completed}</div>
          <div style="font-size:0.75rem;color:var(--muted);margin-top:0.2rem;">This report stays in this browser until you clear it.</div>
        </div>
        <div style="display:flex;gap:0.75rem;flex-wrap:wrap;font-size:0.85rem;align-items:center;">
          <span><strong>${lastRefreshReport.updated}</strong> populated</span>
          <span><strong>${lastRefreshReport.failed}</strong> with issues</span>
          <span><strong>${lastRefreshReport.total}</strong> total</span>
          <button class="btn" style="padding:0.3rem 0.55rem;font-size:0.75rem;" onclick="clearSymbolRefreshReport()">Clear Report</button>
        </div>
      </div>
      <div class="grid-2" style="margin-bottom:0;">
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:0.9rem;">
          <div style="font-size:0.75rem;text-transform:uppercase;font-weight:600;color:var(--muted);letter-spacing:0.04em;margin-bottom:0.5rem;">Populated Symbols</div>
          ${lastRefreshReport.successes.length > 0
            ? `<div style="max-height:220px;overflow:auto;font-size:0.82rem;">${lastRefreshReport.successes.map((item) => `
                <div style="padding:0.35rem 0;border-bottom:1px solid var(--border);">
                  <strong>${item.ticker}</strong>
                  <div style="color:var(--muted);">${item.fields.join(', ')}</div>
                  <div style="color:var(--muted);font-size:0.76rem;">Source: ${item.sources.length > 0 ? item.sources.join(' + ') : 'Unknown'}</div>
                </div>
              `).join('')}</div>`
            : '<div style="font-size:0.82rem;color:var(--muted);">No symbols populated.</div>'}
        </div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:0.9rem;">
          <div style="font-size:0.75rem;text-transform:uppercase;font-weight:600;color:var(--muted);letter-spacing:0.04em;margin-bottom:0.5rem;">Issues</div>
          ${lastRefreshReport.failures.length > 0
            ? `<div style="max-height:220px;overflow:auto;font-size:0.82rem;">${lastRefreshReport.failures.map((item) => `
                <div style="padding:0.35rem 0;border-bottom:1px solid var(--border);">
                  <strong style="color:var(--red);">${item.ticker}</strong>
                  <div style="color:var(--muted);font-size:0.76rem;">API calls: ${item.apiCalls.length > 0 ? item.apiCalls.join(' | ') : 'None'}</div>
                  <div style="color:var(--muted);font-size:0.76rem;">Missing fields: ${item.missingFields.length > 0 ? item.missingFields.join(', ') : 'None'}</div>
                </div>
              `).join('')}</div>`
            : '<div style="font-size:0.82rem;color:var(--accent);">No symbol refresh issues.</div>'}
        </div>
      </div>
    </div>`;
}

function persistSymbolRefreshReport(): void {
  if (!lastRefreshReport) {
    localStorage.removeItem(SYMBOL_REFRESH_REPORT_STORAGE_KEY);
    return;
  }
  localStorage.setItem(SYMBOL_REFRESH_REPORT_STORAGE_KEY, JSON.stringify(lastRefreshReport));
}

function clearSymbolRefreshReport(): void {
  lastRefreshReport = null;
  persistSymbolRefreshReport();
  renderSymbolRefreshReport();
}

function getHoldingBalances(): {
  taxable: number;
  taxableBasis: number;
  taxableCash: number;
  taxableInvested: number;
  taxableInvestedBasis: number;
  ira: number;
  roth: number;
  hsa: number;
} {
  let taxable = 0;
  let taxableBasis = 0;
  let taxableCash = 0;
  let taxableInvested = 0;
  let taxableInvestedBasis = 0;
  let ira = 0;
  let roth = 0;
  let hsa = 0;

  for (const h of holdings) {
    const value = h.shares * h.price;
    const cost = h.shares * h.costBasis;
    if (h.account === 'taxable') {
      taxable += value;
      taxableBasis += cost;
      if (h.category === 'cash') {
        taxableCash += value;
      } else {
        taxableInvested += value;
        taxableInvestedBasis += cost;
      }
    } else if (h.account === 'ira') {
      ira += value;
    } else if (h.account === 'roth') {
      roth += value;
    } else if (h.account === 'hsa') {
      hsa += value;
    }
  }

  return { taxable, taxableBasis, taxableCash, taxableInvested, taxableInvestedBasis, ira, roth, hsa };
}

function renderDrawdown(): void {
  if (holdings.length === 0) {
    $('drawdownArea').innerHTML = '<div class="empty-state"><p>Add holdings to see drawdown analysis.</p></div>';
    return;
  }

  const balances = getHoldingBalances();
  const retireAge = readRetirementAge();
  const currentAge = retireAge;
  const expenses = readFloat('ddExpenses', 40000);
  const inflation = readFloat('ddInflation', 3) / 100;
  const growth = readFloat('ddReturn', 5) / 100;
  const ordTax = readFloat('ddTaxRate', 22) / 100;
  const ltcgTax = readFloat('ddLtcgRate', 15) / 100;
  const ssAnnual = readFloat('ddSS', 0);

  const sim = simulateDrawdown({
    currentAge,
    retireAge,
    expenses,
    inflation,
    returnRate: growth,
    taxRate: ordTax,
    ltcgRate: ltcgTax,
    ssAnnual,
    iraBalance: balances.ira,
    rothBalance: balances.roth + balances.hsa,
    taxableBalance: balances.taxable,
    taxableCostBasis: balances.taxableBasis,
  });

  const { years, totalTaxPaid, depletionAge, finalBalance, totalWithdrawn } = sim;
  if (years.length === 0) {
    $('drawdownArea').innerHTML = '<div class="empty-state"><p>Adjust parameters above to run the simulation.</p></div>';
    return;
  }

  const lastSolvent = years.filter((y) => y.totalBalance > 0);
  const moneyLastsTo = lastSolvent.length > 0 ? lastSolvent[lastSolvent.length - 1].age : retireAge;

  const summaryHtml = `
    <div class="dd-summary-cards">
      <div class="dd-summary-card">
        <div class="label">Money Lasts To</div>
        <div class="value ${depletionAge ? 'orange' : 'green'}">Age ${depletionAge ? depletionAge - 1 : moneyLastsTo + '+'}</div>
        <div class="sub">${depletionAge ? `Runs out at ${depletionAge}` : 'Survives full simulation'}</div>
      </div>
      <div class="dd-summary-card">
        <div class="label">Total Withdrawn</div>
        <div class="value">$${fmtK(totalWithdrawn)}</div>
        <div class="sub">Over ${years.length} years</div>
      </div>
      <div class="dd-summary-card">
        <div class="label">Total Taxes Paid</div>
        <div class="value red">$${fmtK(totalTaxPaid)}</div>
        <div class="sub">${totalWithdrawn > 0 ? `${fmtD((totalTaxPaid / totalWithdrawn) * 100, 1)}% effective rate` : ''}</div>
      </div>
      <div class="dd-summary-card">
        <div class="label">Final Balance</div>
        <div class="value ${finalBalance > 0 ? 'green' : 'red'}">$${fmtK(Math.max(finalBalance, 0))}</div>
        <div class="sub">At age ${years[years.length - 1]?.age || '—'}</div>
      </div>
    </div>`;

  const orderHtml = `
    <div class="dd-strategy">
      <div>
        <div class="te-section-title">Withdrawal Order</div>
        <div class="dd-order">
          <div class="dd-order-item">
            <div class="dd-step-num"></div>
            <div class="dd-step-detail">
              <div class="dd-step-title">Required Minimum Distributions <span class="tax-tag ira">IRA</span></div>
              <div class="dd-step-reason">Mandatory at age 73+. Taxed as ordinary income. Taken first since penalties for missing are severe (25%).</div>
            </div>
          </div>
          <div class="dd-order-item">
            <div class="dd-step-num"></div>
            <div class="dd-step-detail">
              <div class="dd-step-title">Taxable Brokerage <span class="tax-tag taxable">TAX</span></div>
              <div class="dd-step-reason">Only gains are taxed, at the lower LTCG rate. Preserves tax-advantaged accounts for continued compounding.</div>
            </div>
          </div>
          <div class="dd-order-item">
            <div class="dd-step-num"></div>
            <div class="dd-step-detail">
              <div class="dd-step-title">Traditional IRA <span class="tax-tag ira">IRA</span></div>
              <div class="dd-step-reason">Fully taxed as ordinary income. Tap after taxable to reduce lifetime tax burden and manage brackets.</div>
            </div>
          </div>
          <div class="dd-order-item">
            <div class="dd-step-num"></div>
            <div class="dd-step-detail">
              <div class="dd-step-title">Roth IRA / HSA <span class="tax-tag roth">ROTH</span><span class="tax-tag hsa">HSA</span></div>
              <div class="dd-step-reason">Modeled as tax-free assets and saved for last to maximize sheltered compounding. HSA treatment here assumes qualified medical withdrawals.</div>
            </div>
          </div>
        </div>
      </div>
      <div>
        <div class="te-section-title">Key Considerations</div>
        <div style="font-size:0.85rem;color:var(--muted);line-height:1.7;">
          <div style="margin-bottom:0.5rem;"><strong style="color:var(--text)">Before age 59.5:</strong> Only taxable accounts are used — early withdrawal from IRA/Roth can incur a 10% penalty. HSA is modeled separately as Roth-like for qualified medical spending.</div>
          <div style="margin-bottom:0.5rem;"><strong style="color:var(--text)">Age 73+ RMDs:</strong> You must withdraw from Traditional IRA regardless of need. Excess RMDs above expenses are assumed reinvested in taxable.</div>
          <div style="margin-bottom:0.5rem;"><strong style="color:var(--text)">Social Security:</strong> Reduces the amount you need to withdraw, kicking in at age 67 and adjusting for inflation.</div>
          <div><strong style="color:var(--text)">Tax bracket management:</strong> In low-income early retirement years, consider Roth conversions to move IRA money to Roth at a low rate before RMDs begin.</div>
        </div>
      </div>
    </div>`;

  const chartHtml = `
    <div class="dd-chart-wrap">
      <div class="te-section-title">Account Balances Over Time</div>
      <canvas id="ddChart" style="width:100%;height:250px;"></canvas>
      <div class="dd-chart-legend">
        <span><span class="dot" style="background:var(--orange)"></span> Taxable</span>
        <span><span class="dot" style="background:var(--purple)"></span> Traditional IRA</span>
        <span><span class="dot" style="background:var(--blue)"></span> Roth / HSA</span>
        <span><span class="dot" style="background:var(--red);opacity:0.5"></span> Shortfall</span>
      </div>
    </div>`;

  const tableHtml = `
    <div class="te-section-title">Year-by-Year Projection</div>
    <div style="max-height:400px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;">
      <table class="dd-year-table">
        <thead><tr>
          <th>Age</th><th>Expenses</th><th>SS</th><th>From Taxable</th><th>From IRA</th><th>From Roth/HSA</th><th>Taxes</th>
          <th>Bal: Taxable</th><th>Bal: IRA</th><th>Bal: Roth/HSA</th><th>Total</th>
        </tr></thead>
        <tbody>${years.map((y) => {
          const depleted = y.totalBalance <= 0 && y.shortfall > 0;
          const isRmd = y.rmdAmount > 0;
          return `<tr class="${depleted ? 'dd-depleted' : ''} ${isRmd ? 'dd-rmd' : ''}">
            <td>Age ${y.age}</td>
            <td>$${fmtK(y.expenses)}</td>
            <td>${y.ss > 0 ? `$${fmtK(y.ss)}` : '—'}</td>
            <td>${y.fromTaxable > 0 ? `$${fmtK(y.fromTaxable)}` : '—'}</td>
            <td>${y.fromIra > 0 ? `$${fmtK(y.fromIra)}` : '—'}${isRmd ? ' <span style="color:var(--orange);font-size:0.7rem;">RMD</span>' : ''}</td>
            <td>${y.fromRoth > 0 ? `$${fmtK(y.fromRoth)}` : '—'}</td>
            <td style="color:var(--red)">${y.taxesPaid > 0 ? `$${fmtK(y.taxesPaid)}` : '—'}</td>
            <td>$${fmtK(y.balTaxable)}</td>
            <td>$${fmtK(y.balIra)}</td>
            <td>$${fmtK(y.balRoth)}</td>
            <td style="font-weight:600;${y.shortfall > 0 ? 'color:var(--red)' : ''}">$${fmtK(y.totalBalance)}${y.shortfall > 0 ? `<br><span style="font-size:0.7rem">-$${fmtK(y.shortfall)} short</span>` : ''}</td>
          </tr>`;
        }).join('')}</tbody>
      </table>
    </div>`;

  $('drawdownArea').innerHTML = summaryHtml + orderHtml + chartHtml + tableHtml;
  drawDrawdownChart(years);
}

function drawDrawdownChart(years: Array<{
  age: number;
  balTaxable: number;
  balIra: number;
  balRoth: number;
  shortfall: number;
}>): void {
  const canvas = document.getElementById('ddChart') as HTMLCanvasElement | null;
  if (!canvas || !canvas.parentElement) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.parentElement.getBoundingClientRect();
  const w = rect.width;
  const h = 250;

  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  const padL = 65;
  const padR = 20;
  const padT = 15;
  const padB = 30;
  const cw = w - padL - padR;
  const ch = h - padT - padB;
  const maxBal = Math.max(...years.map((y) => y.balTaxable + y.balIra + y.balRoth), 1) * 1.1;
  const barW = Math.max(2, (cw / years.length) - 1);
  const gap = (cw - barW * years.length) / years.length;

  ctx.strokeStyle = '#2a2d3a';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 5; i++) {
    const val = (maxBal / 5) * i;
    const yPos = padT + ch - (val / maxBal) * ch;
    ctx.beginPath();
    ctx.moveTo(padL, yPos);
    ctx.lineTo(w - padR, yPos);
    ctx.stroke();
    ctx.fillStyle = '#9294a0';
    ctx.font = '10px -apple-system, system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`$${fmtK(val)}`, padL - 8, yPos + 3);
  }

  for (let i = 0; i < years.length; i++) {
    const y = years[i];
    const x = padL + i * (barW + gap);
    let currentY = padT + ch;

    for (const seg of [
      { val: y.balTaxable, color: '#f97316' },
      { val: y.balIra, color: '#a855f7' },
      { val: y.balRoth, color: '#3b82f6' },
    ]) {
      if (seg.val <= 0) continue;
      const segH = (seg.val / maxBal) * ch;
      currentY -= segH;
      ctx.fillStyle = seg.color;
      ctx.fillRect(x, currentY, barW, segH);
    }

    if (y.shortfall > 0) {
      ctx.fillStyle = 'rgba(239,68,68,0.3)';
      const segH = Math.max((y.shortfall / maxBal) * ch, 3);
      ctx.fillRect(x, padT + ch - segH, barW, segH);
    }

    if (i % 5 === 0 || i === years.length - 1) {
      ctx.fillStyle = '#9294a0';
      ctx.font = '10px -apple-system, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(y.age), x + barW / 2, h - 8);
    }
  }
}

function renderHealthcare(): void {
  renderHcAgeTable();
  renderHcIncomeTable();
  renderMedicareProjection();
}

function getHouseholdAcaPremiums(primaryAge: number): {
  householdSize: number;
  monthlyGold: number;
  monthlyBenchmark: number;
  spouseAgeAtPrimaryAge: number | null;
} {
  const household = getPlannerHouseholdProfile();
  const monthlyGold = estimateGoldPremium(primaryAge);
  const monthlyBenchmark = estimateBenchmarkPremium(primaryAge);
  if (household.filingStatus !== 'married') {
    return { householdSize: household.householdSize, monthlyGold, monthlyBenchmark, spouseAgeAtPrimaryAge: null };
  }

  const ageOffset = primaryAge - household.currentAge;
  const spouseAgeAtPrimaryAge = household.spouseAge + ageOffset;
  const spousePre65 = spouseAgeAtPrimaryAge < 65;
  return {
    householdSize: household.householdSize,
    monthlyGold: spousePre65 ? monthlyGold + estimateGoldPremium(spouseAgeAtPrimaryAge) : monthlyGold,
    monthlyBenchmark: spousePre65 ? monthlyBenchmark + estimateBenchmarkPremium(spouseAgeAtPrimaryAge) : monthlyBenchmark,
    spouseAgeAtPrimaryAge,
  };
}

function renderHcAgeTable(): void {
  const earned = 0;
  const inv = getInvestmentIncome();
  const income = earned + inv.total;
  const household = getPlannerHouseholdProfile();
  const fplRatio = income / (ACA_FPL_BASELINE + Math.max(household.householdSize - 1, 0) * ACA_FPL_ADDITIONAL_PERSON_BASELINE);
  const cliffAmt = getAcaCliff(0, 0, household.householdSize);

  $('hcIncomeDisplay').textContent = `$${fmt(Math.round(income))}`;
  $('hcFplDisplay').textContent = `${fmtD(fplRatio * 100, 0)}% FPL`;
  $('hcMagiBreakdown').textContent = `Retirement assumption: $0 earned income + $${fmt(Math.round(inv.total))} investment income across a household of ${household.householdSize}`;

  if (fplRatio > 4.0) {
    $('hcCliffWarning').innerHTML = `
      <div class="hc-cliff-warning">
        <strong>Above the subsidy cliff.</strong> At $${fmt(income)} MAGI (${fmtD(fplRatio * 100, 0)}% FPL), you exceed the 400% FPL threshold of $${fmt(Math.round(cliffAmt))}.
        You receive no ACA premium subsidy and must pay the full Gold plan premium. Reducing MAGI by $${fmt(Math.round(income - cliffAmt + 1))} would restore subsidy eligibility.
      </div>`;
  } else if (fplRatio > 3.5) {
    $('hcCliffWarning').innerHTML = `
      <div class="hc-cliff-warning" style="background:#422006;border-color:rgba(249,115,22,0.3);">
        <strong style="color:var(--orange)">Near the cliff.</strong> You're at ${fmtD(fplRatio * 100, 0)}% FPL — only $${fmt(Math.round(cliffAmt - income))} below the 400% FPL cliff.
        Any additional income (Roth conversion, capital gains, etc.) could eliminate your entire subsidy.
      </div>`;
  } else {
    $('hcCliffWarning').innerHTML = '';
  }

  const userAge = readRetirementAge();
  if (userAge >= 65) {
    $('hcSummaryRow').innerHTML = '<div class="dd-summary-card" style="grid-column:1/-1;"><div class="label">Medicare Eligible</div><div class="value green">Age ' + userAge + '</div><div class="sub">You\'re 65+ — eligible for Medicare. ACA marketplace plans no longer apply.</div></div>';
    $('hcAgeTable').innerHTML = '';
    $('hcCliffWarning').innerHTML = '';
    return;
  }

  const ages: number[] = [];
  for (let age = Math.max(userAge, 26); age <= 64; age++) ages.push(age);

  let totalGold = 0;
  let totalSubsidy = 0;
  let totalNet = 0;
  const maxPremium = getHouseholdAcaPremiums(64).monthlyGold * 12;

  const rows = ages.map((age) => {
    const premiums = getHouseholdAcaPremiums(age);
    const aca = calcAcaSubsidy(income, age, premiums.householdSize, premiums.monthlyBenchmark, premiums.monthlyGold);
    totalGold += aca.goldPremium;
    totalSubsidy += aca.subsidy;
    totalNet += aca.netPremium;
    const barPct = (aca.goldPremium / maxPremium) * 100;
    const subsidyPct = aca.subsidy > 0 ? (aca.subsidy / aca.goldPremium) * 100 : 0;

    return `<tr${age === userAge ? ' style="outline:2px solid var(--accent);outline-offset:-2px;"' : age >= 45 && age <= 64 && age % 5 === 0 ? ' class="hc-highlight"' : ''}>
      <td>Age ${age}${age === userAge ? ' (you)' : ''}${premiums.spouseAgeAtPrimaryAge !== null ? `<div style="font-size:0.72rem;color:var(--muted);">Spouse ${Math.round(premiums.spouseAgeAtPrimaryAge)}</div>` : ''}</td>
      <td>$${fmt(aca.monthlyGold)}</td>
      <td>$${fmt(aca.goldPremium)}</td>
      <td>$${fmt(aca.monthlyBenchmark)}</td>
      <td style="color:${aca.medicaidEligible || aca.eligible ? 'var(--accent)' : 'var(--red)'}">${aca.medicaidEligible ? 'Medicaid' : aca.eligible ? `$${fmt(Math.round(aca.subsidy / 12))}/mo` : 'None'}</td>
      <td style="color:${aca.medicaidEligible || aca.eligible ? 'var(--accent)' : 'var(--red)'}">${aca.medicaidEligible ? '$0/yr' : aca.eligible ? `$${fmt(aca.subsidy)}/yr` : 'None'}</td>
      <td style="font-weight:600;">$${fmt(Math.round(aca.netPremium / 12))}/mo</td>
      <td style="font-weight:600;">$${fmt(aca.netPremium)}/yr</td>
      <td class="hc-bar-cell">
        <div class="hc-bar-bg">
          <div class="hc-bar-fill" style="width:${barPct}%;background:var(--muted);"></div>
          <div class="hc-bar-fill" style="width:${subsidyPct}%;background:var(--accent);margin-top:-8px;opacity:0.7;"></div>
        </div>
      </td>
    </tr>`;
  }).join('');

  const sampleAge = Math.min(Math.max(userAge, 26), 64);
  const samplePremiums = getHouseholdAcaPremiums(sampleAge);
  const sampleAca = calcAcaSubsidy(income, sampleAge, samplePremiums.householdSize, samplePremiums.monthlyBenchmark, samplePremiums.monthlyGold);
  const preRetireTotal = ages.reduce((sum, age) => {
    const premiums = getHouseholdAcaPremiums(age);
    return sum + calcAcaSubsidy(income, age, premiums.householdSize, premiums.monthlyBenchmark, premiums.monthlyGold).netPremium;
  }, 0);
  const preRetireSubsidy = ages.reduce((sum, age) => {
    const premiums = getHouseholdAcaPremiums(age);
    return sum + calcAcaSubsidy(income, age, premiums.householdSize, premiums.monthlyBenchmark, premiums.monthlyGold).subsidy;
  }, 0);

  $('hcSummaryRow').innerHTML = `
    <div class="dd-summary-card">
      <div class="label">Gold Plan at ${sampleAge}</div>
      <div class="value">$${fmt(sampleAca.monthlyGold)}/mo</div>
      <div class="sub">$${fmt(sampleAca.goldPremium)}/yr full price</div>
    </div>
    <div class="dd-summary-card">
      <div class="label">Your Net at ${sampleAge}</div>
      <div class="value ${sampleAca.eligible ? 'green' : 'red'}">$${fmt(Math.round(sampleAca.netPremium / 12))}/mo</div>
      <div class="sub">${sampleAca.medicaidEligible ? 'Modeled as Medicaid with $0 medical cost' : sampleAca.eligible ? `Subsidy covers $${fmt(Math.round(sampleAca.subsidy / 12))}/mo` : 'No subsidy — full price'}</div>
    </div>
    <div class="dd-summary-card">
      <div class="label">Now to Medicare Cost</div>
      <div class="value">$${fmtK(preRetireTotal)}</div>
      <div class="sub">${ages.length} years (age ${ages[0] || '?'} to 64)</div>
    </div>
    <div class="dd-summary-card">
      <div class="label">Total Subsidies</div>
      <div class="value green">$${fmtK(preRetireSubsidy)}</div>
      <div class="sub">Savings from ACA subsidies</div>
    </div>`;

  $('hcAgeTable').innerHTML = `
    <div style="overflow-x:auto;border:1px solid var(--border);border-radius:8px;">
      <table class="hc-age-table">
        <thead><tr>
          <th>Age</th>
          <th>Gold Monthly</th><th>Gold Annual</th>
          <th>Silver Benchmark</th>
          <th>Subsidy (mo)</th><th>Subsidy (yr)</th>
          <th>You Pay (mo)</th><th>You Pay (yr)</th>
          <th>Premium vs Subsidy</th>
        </tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr style="font-weight:700;border-top:2px solid var(--border);">
          <td>Total (all ages)</td>
          <td></td><td>$${fmtK(totalGold)}</td>
          <td></td>
          <td></td><td style="color:var(--accent)">$${fmtK(totalSubsidy)}</td>
          <td></td><td>$${fmtK(totalNet)}</td>
          <td></td>
        </tr></tfoot>
      </table>
    </div>
    <div style="margin-top:0.75rem;font-size:0.78rem;color:var(--muted);">
      Gold plan premiums estimated using the ${ACA_PLANNING_BASELINE_LABEL} national averages ($650/mo at age 40) with the federal ACA age curve.
      Subsidies calculated against the Silver benchmark ($625/mo at age 40). Household size is set to ${household.householdSize}. Actual premiums vary by location.
      <span style="display:inline-flex;align-items:center;gap:0.3rem;margin-left:0.5rem;">
        <span class="dot" style="width:8px;height:8px;border-radius:2px;background:var(--muted);display:inline-block;"></span> Full premium
        <span class="dot" style="width:8px;height:8px;border-radius:2px;background:var(--accent);display:inline-block;margin-left:0.5rem;"></span> Subsidy portion
      </span>
    </div>`;
}

function renderHcIncomeTable(): void {
  const age = Math.min(readRetirementAge(), 64);
  const premiums = getHouseholdAcaPremiums(age);
  const cliffAmt = Math.round(getAcaCliff(0, 0, premiums.householdSize));
  const incomes = [15000, 20000, 25000, 30000, 35000, 40000, 45000, 50000, 55000, 60000, cliffAmt - 1000, cliffAmt, cliffAmt + 500, 65000, 70000, 80000, 100000, 120000]
    .filter((income, index, arr) => income > 0 && arr.indexOf(income) === index)
    .sort((a, b) => a - b);
  const goldMonthly = premiums.monthlyGold;
  const goldAnnual = goldMonthly * 12;

  $('hcIncomeTable').innerHTML = `
    <div style="overflow-x:auto;border:1px solid var(--border);border-radius:8px;">
      <table class="hc-age-table">
        <thead><tr>
          <th>MAGI</th><th>% FPL</th><th>Gold Plan</th><th>Subsidy</th><th>You Pay (mo)</th><th>You Pay (yr)</th><th></th>
        </tr></thead>
        <tbody>${incomes.map((inc, index) => {
          const aca = calcAcaSubsidy(inc, age, premiums.householdSize, premiums.monthlyBenchmark, premiums.monthlyGold);
          const householdFpl = getAcaCliff(0, 0, premiums.householdSize) / 4;
          const fplPct = fmtD((inc / householdFpl) * 100, 0);
          const prev = incomes[index - 1] || 0;
          const isCliff = inc > cliffAmt && prev <= cliffAmt;
          const atCliff = Math.abs(inc - cliffAmt) < 1000;
          const subsidyBarPct = aca.subsidy > 0 ? (aca.subsidy / goldAnnual) * 100 : 0;
          return `<tr style="${isCliff ? 'border-top:2px solid var(--red);' : ''}${atCliff ? 'background:rgba(239,68,68,0.05);' : ''}">
            <td>$${fmt(inc)}</td>
            <td>${fplPct}%</td>
            <td>$${fmt(goldMonthly)}/mo</td>
            <td style="color:${aca.medicaidEligible || aca.eligible ? 'var(--accent)' : 'var(--red)'}">${aca.medicaidEligible ? 'Medicaid' : aca.eligible ? `$${fmt(Math.round(aca.subsidy / 12))}/mo ($${fmt(aca.subsidy)}/yr)` : 'No subsidy'}</td>
            <td style="font-weight:700;${!aca.eligible && !aca.medicaidEligible ? 'color:var(--red);' : ''}">$${fmt(Math.round(aca.netPremium / 12))}/mo</td>
            <td style="font-weight:600;">$${fmt(aca.netPremium)}/yr</td>
            <td class="hc-bar-cell">
              <div class="hc-bar-bg">
                <div class="hc-bar-fill" style="width:100%;background:${aca.medicaidEligible || aca.eligible ? 'var(--muted)' : 'var(--red)'};opacity:0.3;"></div>
                <div class="hc-bar-fill" style="width:${subsidyBarPct}%;background:var(--accent);margin-top:-8px;"></div>
              </div>
            </td>
          </tr>`;
        }).join('')}</tbody>
      </table>
    </div>
    <div style="margin-top:0.75rem;font-size:0.78rem;color:var(--muted);">
      All values for a ${age}-year-old on a Gold plan ($${fmt(goldMonthly)}/mo full price).
      <span style="color:var(--red);">Red line</span> marks the 400% FPL subsidy cliff at $${fmt(cliffAmt)} on the ${ACA_PLANNING_BASELINE_LABEL}.
      Near the cliff, a small MAGI increase can eliminate the modeled subsidy entirely.
    </div>`;
}

function renderMedicareProjection(): void {
  const userAge = readRetirementAge();
  const lifeExp = readInt('coLifeExp', 90);
  const magi = getMagi() || 30000;
  const inflation = PLANNING_GROWTH_RATES.healthcareCosts;

  if (userAge > lifeExp) {
    $('medicareSummaryRow').innerHTML = '';
    $('medicareTable').innerHTML = '';
    $('medicareSources').innerHTML = '';
    return;
  }

  const startAge = Math.max(userAge, 65);
  const years: Array<{ age: number; premiums: number; oop: number; irmaa: number; total: number }> = [];
  let totalPremiums = 0;
  let totalOop = 0;
  let totalIrmaa = 0;
  let totalAll = 0;

  for (let age = startAge; age <= lifeExp; age++) {
    const costs = getMedicareAnnualCost(age, magi, inflation, age - 65);
    years.push({ age, ...costs });
    totalPremiums += costs.premiums;
    totalOop += costs.oop;
    totalIrmaa += costs.irmaa;
    totalAll += costs.total;
  }

  const currentCost = years[0] || { total: 0, premiums: 0, oop: 0, irmaa: 0 };
  const irmaaInfo = getIrmaaSurcharge(magi);
  const yearsOnMedicare = years.length;

  $('medicareSummaryRow').innerHTML = `
    <div class="dd-summary-card">
      <div class="label">Annual Cost at ${startAge}</div>
      <div class="value">$${fmt(currentCost.total)}</div>
      <div class="sub">$${fmt(Math.round(currentCost.total / 12))}/mo total</div>
    </div>
    <div class="dd-summary-card">
      <div class="label">Lifetime Medicare Cost</div>
      <div class="value">$${fmtK(totalAll)}</div>
      <div class="sub">${yearsOnMedicare} years (age ${startAge} to ${lifeExp})</div>
    </div>
    <div class="dd-summary-card">
      <div class="label">IRMAA Surcharge</div>
      <div class="value ${irmaaInfo.total > 0 ? 'red' : 'green'}">${irmaaInfo.total > 0 ? `$${fmt(irmaaInfo.total)}/yr` : 'None'}</div>
      <div class="sub">${irmaaInfo.total > 0 ? `Based on $${fmt(magi)} MAGI` : 'MAGI under $106K threshold'}</div>
    </div>
    <div class="dd-summary-card">
      <div class="label">Avg Annual Cost</div>
      <div class="value">$${fmt(yearsOnMedicare > 0 ? Math.round(totalAll / yearsOnMedicare) : 0)}</div>
      <div class="sub">Including ${fmtD(inflation * 100, 0)}% annual healthcare cost growth</div>
    </div>`;

  const pre65Note = userAge < 65
    ? `<div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:1rem 1.25rem;margin-bottom:1rem;font-size:0.85rem;">
        <strong>You're ${userAge}</strong> — Medicare starts at 65. See the ACA sections above for your pre-Medicare healthcare costs.
        The projection below shows estimated costs from age 65 onward.
      </div>`
    : '';

  const maxPremium = years.length > 0 ? Math.max(...years.map((y) => y.total)) : 1;

  $('medicareTable').innerHTML = pre65Note + `
    <div style="overflow-x:auto;border:1px solid var(--border);border-radius:8px;">
      <table class="hc-age-table">
        <thead><tr>
          <th>Age</th><th>Premiums + Medigap</th><th>Out-of-Pocket</th><th>IRMAA</th><th>Total</th><th>Monthly</th><th></th>
        </tr></thead>
        <tbody>${years.map((y) => {
          const barPct = (y.total / maxPremium) * 100;
          const premPct = (y.premiums / y.total) * 100;
          return `<tr${y.age === userAge ? ' style="outline:2px solid var(--accent);outline-offset:-2px;"' : y.age % 5 === 0 ? ' class="hc-highlight"' : ''}>
            <td>Age ${y.age}${y.age === userAge ? ' (you)' : y.age === 65 ? ' (Medicare starts)' : y.age === 73 ? ' (RMDs start)' : ''}</td>
            <td>$${fmt(y.premiums)}</td>
            <td>$${fmt(y.oop)}</td>
            <td style="color:${y.irmaa > 0 ? 'var(--red)' : 'var(--muted)'}">${y.irmaa > 0 ? `$${fmt(y.irmaa)}` : '—'}</td>
            <td style="font-weight:700;">$${fmt(y.total)}</td>
            <td>$${fmt(Math.round(y.total / 12))}/mo</td>
            <td class="hc-bar-cell">
              <div class="hc-bar-bg">
                <div class="hc-bar-fill" style="width:${barPct}%;background:var(--blue);opacity:0.4;"></div>
                <div class="hc-bar-fill" style="width:${premPct * barPct / 100}%;background:var(--blue);margin-top:-8px;"></div>
              </div>
            </td>
          </tr>`;
        }).join('')}</tbody>
        <tfoot><tr style="font-weight:700;border-top:2px solid var(--border);">
          <td>Lifetime Total</td>
          <td>$${fmtK(totalPremiums)}</td>
          <td>$${fmtK(totalOop)}</td>
          <td style="color:${totalIrmaa > 0 ? 'var(--red)' : 'var(--muted)'}">${totalIrmaa > 0 ? `$${fmtK(totalIrmaa)}` : '—'}</td>
          <td>$${fmtK(totalAll)}</td>
          <td></td><td></td>
        </tr></tfoot>
      </table>
    </div>`;

  $('medicareSources').innerHTML = `
    <div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:1rem 1.25rem;margin-top:1rem;">
      <div style="font-size:0.8rem;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:0.75rem;">IRMAA Income Brackets (${MEDICARE_PLANNING_BASELINE_LABEL})</div>
      <div style="font-size:0.82rem;color:var(--text);line-height:1.6;">
        IRMAA surcharges apply to Part B and Part D premiums when your MAGI (from 2 years prior) exceeds thresholds.
        Your current MAGI of <strong>$${fmt(magi)}</strong> ${irmaaInfo.total > 0 ? `triggers <span style="color:var(--red);">$${fmt(irmaaInfo.total)}/yr</span> in surcharges` : 'is <span style="color:var(--accent);">below the $106K threshold</span> — no surcharges'}.
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:0.8rem;margin-top:0.75rem;">
        <thead><tr style="border-bottom:1px solid var(--border);">
          <th style="text-align:left;padding:0.3rem 0.5rem;color:var(--muted);">MAGI</th>
          <th style="text-align:right;padding:0.3rem 0.5rem;color:var(--muted);">Part B Extra</th>
          <th style="text-align:right;padding:0.3rem 0.5rem;color:var(--muted);">Part D Extra</th>
          <th style="text-align:right;padding:0.3rem 0.5rem;color:var(--muted);">Total/yr</th>
        </tr></thead>
        <tbody>${IRMAA_BRACKETS.map((b, i, arr) => {
          const prev = i > 0 ? arr[i - 1].maxMagi : 0;
          const label = b.maxMagi === Infinity ? '> $500K' : (i === 0 ? `≤ $${fmt(b.maxMagi)}` : `$${fmt(prev + 1)} – $${fmt(b.maxMagi)}`);
          const active = magi <= b.maxMagi && (i === 0 || magi > arr[i - 1].maxMagi);
          return `<tr style="${active ? 'background:rgba(34,197,94,0.08);font-weight:600;' : ''}">
            <td style="padding:0.3rem 0.5rem;">${label}${active ? ' ← you' : ''}</td>
            <td style="text-align:right;padding:0.3rem 0.5rem;">${b.partBSurcharge > 0 ? `$${fmt(b.partBSurcharge)}` : '—'}</td>
            <td style="text-align:right;padding:0.3rem 0.5rem;">${b.partDSurcharge > 0 ? `$${fmt(b.partDSurcharge)}` : '—'}</td>
            <td style="text-align:right;padding:0.3rem 0.5rem;font-weight:600;">${(b.partBSurcharge + b.partDSurcharge) > 0 ? `$${fmt(b.partBSurcharge + b.partDSurcharge)}` : 'None'}</td>
          </tr>`;
        }).join('')}</tbody>
      </table>
    </div>

    <div style="margin-top:1rem;padding:1rem 1.25rem;background:var(--bg);border:1px solid var(--border);border-radius:10px;font-size:0.78rem;color:var(--muted);line-height:1.7;">
      <div style="font-weight:600;color:var(--text);margin-bottom:0.5rem;">How this is calculated</div>
      <strong>Premiums</strong> include Part B, Part D, Part B deductible, and Medigap supplemental coverage.<br>
      <strong>Out-of-pocket</strong> costs include copays, coinsurance, dental, vision, and hearing — but exclude long-term care.<br>
      <strong>IRMAA</strong> surcharges are based on MAGI from 2 years prior. Roth conversions increase MAGI and can trigger surcharges.<br>
      <strong>Healthcare inflation</strong> of 3%/yr is applied from age 65 forward.
    </div>`;
}

function renderLifetimePlan(prefix: 'co' | 'dp', allowConversion: boolean): void {
  const portfolioBalances = getHoldingBalances();
  const startAge = readRetirementAge();
  const lifeExp = readInt(`${prefix}LifeExp`, 90);
  const earnedIncome = 0;
  const annualSpending = readFloat(`${prefix}Spending`, 50000);
  const inflation = readFloat('inflationRate', 3) / 100;
  const healthcareInflation = 0.03;
  const householdSize = readHouseholdSize();
  const pre65HealthcareLoad = 1.5;
  const iraBalance = portfolioBalances.ira;
  const taxableCashBal = portfolioBalances.taxableCash;
  const taxableInvestedBal = portfolioBalances.taxableInvested;
  const taxableBasis = portfolioBalances.taxableInvestedBasis;
  const rothBal = portfolioBalances.roth + portfolioBalances.hsa;
  const ssIncome = readFloat(`${prefix}SSIncome`, 20000);
  const strategy = allowConversion ? $(`${prefix}Strategy`).value : 'none';
  const convEndAge = 72;
  const taxableCashHoldings = holdings.filter((holding) => holding.account === 'taxable' && holding.category === 'cash');
  const investedTargetMix = deriveInvestedTargetMix(holdings, yieldCache);
  const estimatedRebalancedMix = rebalanceInvestedAccounts(
    {
      taxable: taxableInvestedBal,
      ira: iraBalance,
      roth: rothBal,
    },
    investedTargetMix,
  );
  const estimatedTaxableGrowthPct = estimateAccountReturnFromBalances(estimatedRebalancedMix, 'taxable');
  const estimatedIraGrowthPct = estimateAccountReturnFromBalances(estimatedRebalancedMix, 'ira');
  const estimatedRothGrowthPct = estimateAccountReturnFromBalances(estimatedRebalancedMix, 'roth');
  const estimatedTaxableCashGrowthPct = taxableCashHoldings.length > 0
    ? estimateAccountReturn(taxableCashHoldings, ['taxable'], yieldCache)
    : CATEGORY_TOTAL_RETURNS.cash;
  const taxableReturnOverride = $(`${prefix}TaxableReturn`).value.trim();
  const iraReturnOverride = $(`${prefix}IraReturn`).value.trim();
  const rothReturnOverride = $(`${prefix}RothReturn`).value.trim();
  const taxableGrowthPct = readFloat(`${prefix}TaxableReturn`, estimatedTaxableGrowthPct);
  const iraGrowthPct = readFloat(`${prefix}IraReturn`, estimatedIraGrowthPct);
  const rothGrowthPct = readFloat(`${prefix}RothReturn`, estimatedRothGrowthPct);
  const taxableCashGrowthPct = taxableReturnOverride ? taxableGrowthPct : estimatedTaxableCashGrowthPct;
  const taxableCashGrowth = taxableCashGrowthPct / 100;
  const taxableCashYield = taxableCashHoldings.length > 0
    ? estimateAccountYield(taxableCashHoldings, ['taxable'], getHoldingYield) / 100
    : 0;

  ($(`${prefix}TaxableReturn`) as HTMLInputElement).placeholder = fmtD(estimatedTaxableGrowthPct, 1);
  ($(`${prefix}IraReturn`) as HTMLInputElement).placeholder = fmtD(estimatedIraGrowthPct, 1);
  ($(`${prefix}RothReturn`) as HTMLInputElement).placeholder = fmtD(estimatedRothGrowthPct, 1);

  if (holdings.length === 0) {
    $(`${prefix}Assumptions`).innerHTML = '';
    $(`${prefix}Results`).innerHTML = `<div class="co-optimal-callout neutral"><div class="co-optimal-title">Add holdings to run the ${allowConversion ? 'Roth conversion calculator' : 'drawdown plan'}.</div><div class="co-optimal-sub">This view derives balances and growth assumptions from your actual portfolio.</div></div>`;
    return;
  }

  if (allowConversion && iraBalance <= 0) {
    $(`${prefix}Assumptions`).textContent = `Using holdings-based assumptions. The simulator rebalances invested assets yearly to your current portfolio mix while preferring tax-efficient placement, so taxable invested defaults to ${fmtD(estimatedTaxableGrowthPct, 1)}%, IRA to ${fmtD(estimatedIraGrowthPct, 1)}%, and Roth/HSA to ${fmtD(estimatedRothGrowthPct, 1)}%${taxableReturnOverride || iraReturnOverride || rothReturnOverride ? '; manual overrides replace those defaults where entered' : ''}. Taxable cash uses ${fmtD(estimatedTaxableCashGrowthPct, 1)}% unless the taxable override is set.`;
    $(`${prefix}Results`).innerHTML = '<div class="co-optimal-callout neutral"><div class="co-optimal-title">No Traditional IRA holdings found.</div><div class="co-optimal-sub">Add or import Traditional IRA holdings to compare conversion scenarios.</div></div>';
    return;
  }

  $(`${prefix}Assumptions`).textContent = `Using current holdings automatically. Retirement earned income is assumed to be $0. The simulator rebalances invested assets yearly to your current portfolio mix while preferring bonds and other tax-inefficient assets in IRA first, then Roth/HSA, then taxable if needed. Taxable invested uses ${fmtD(taxableGrowthPct, 1)}%${taxableReturnOverride ? ` (manual; estimated ${fmtD(estimatedTaxableGrowthPct, 1)}%)` : ' (rebalanced taxable mix estimate)'}, taxable cash uses ${fmtD(taxableCashGrowthPct, 1)}%${taxableReturnOverride ? ' (matching manual taxable override)' : ' (cash estimate)'}, IRA uses ${fmtD(iraGrowthPct, 1)}%${iraReturnOverride ? ` (manual; estimated ${fmtD(estimatedIraGrowthPct, 1)}%)` : ' (rebalanced IRA mix estimate)'}, and Roth/HSA uses ${fmtD(rothGrowthPct, 1)}%${rothReturnOverride ? ` (manual; estimated ${fmtD(estimatedRothGrowthPct, 1)}%)` : ' (rebalanced Roth/HSA mix estimate)'}. Base spending is inflated by ${fmtD(inflation * 100, 1)}% per year. Pre-65 healthcare uses ACA Gold premiums net of subsidies for a household of ${householdSize} with a 50% load and ${fmtD(healthcareInflation * 100, 1)}% healthcare inflation, and 65+ uses the Medicare model for premiums, out-of-pocket, and IRMAA. Taxable cash is spent before selling appreciated taxable assets.${allowConversion ? '' : ' Roth conversions are disabled in this view.'}`;

  if (startAge >= lifeExp) {
    $(`${prefix}Results`).innerHTML = '<div class="co-optimal-callout neutral"><div class="co-optimal-title">Life expectancy must be greater than current age.</div></div>';
    return;
  }

  function buildIncomeState(otherOrdinaryIncome: number, capitalGains: number, socialSecurityIncome: number) {
    const taxableSocialSecurity = calcTaxableSocialSecurity(otherOrdinaryIncome, capitalGains, socialSecurityIncome);
    const taxOrdinaryIncome = otherOrdinaryIncome + taxableSocialSecurity;
    const taxIncome = taxOrdinaryIncome + capitalGains;
    const acaIncome = otherOrdinaryIncome + capitalGains + socialSecurityIncome;
    return {
      taxableSocialSecurity,
      taxOrdinaryIncome,
      taxIncome,
      acaIncome,
      medicareIncome: taxIncome,
    };
  }

  function estimateAnnualHealthcareCost(age: number, yearsFromStart: number, magi: number): { annualCost: number; acaSub: number } {
    if (age >= 65) {
      const medicare = getMedicareAnnualCost(age, magi, healthcareInflation, age - 65);
      return { annualCost: medicare.total, acaSub: 0 };
    }

    const inflationFactor = Math.pow(1 + healthcareInflation, yearsFromStart);
    const aca = calcAcaSubsidyForYear(magi, age, yearsFromStart, inflation, householdSize);
    const acaSub = aca.medicaidEligible ? 0 : (aca.subsidy || 0) * inflationFactor;
    return {
      annualCost: aca.netPremium * inflationFactor * pre65HealthcareLoad,
      acaSub,
    };
  }

  function projectPre65AcaIncome(
    age: number,
    yearsFromStart: number,
    baselineOtherOrdinaryIncome: number,
    socialSecurityIncome: number,
    baselineAfterTaxCash: number,
    baselineTax: number,
    baseSpending: number,
    availableTaxableCash: number,
    availableTaxableInvested: number,
    availableTaxableCostBasis: number,
    availableRoth: number,
    convAmt: number,
  ): number {
    const ordinaryIncomeExSs = baselineOtherOrdinaryIncome + convAmt;
    let incomeState = buildIncomeState(ordinaryIncomeExSs, 0, socialSecurityIncome);
    const currentTax = calcFederalIncomeTax(incomeState.taxOrdinaryIncome, 0, yearsFromStart, inflation).totalTax;
    const convTax = currentTax - baselineTax;
    let healthcare = estimateAnnualHealthcareCost(age, yearsFromStart, incomeState.acaIncome);
    let spendingNeed = baseSpending + healthcare.annualCost;
    let netCashAfterTaxes = baselineAfterTaxCash - convTax;
    let spentThisYear = Math.max(Math.min(netCashAfterTaxes, spendingNeed), 0);
    let remaining = normalizeShortfall(spendingNeed - spentThisYear);
    let realizedTaxableGains = 0;

    if (remaining > 0 && availableTaxableCash > 0) {
      const cashDraw = Math.min(remaining, availableTaxableCash);
      netCashAfterTaxes += cashDraw;
      spentThisYear = Math.max(Math.min(netCashAfterTaxes, spendingNeed), 0);
      remaining = normalizeShortfall(spendingNeed - spentThisYear);
    }

    if (remaining > 0 && availableRoth > 0) {
      const rothDraw = Math.min(remaining, availableRoth);
      netCashAfterTaxes += rothDraw;
      spentThisYear = Math.max(Math.min(netCashAfterTaxes, spendingNeed), 0);
      remaining = normalizeShortfall(spendingNeed - spentThisYear);
    }

    if (remaining > 0 && availableTaxableInvested > 0) {
      const gainRatio = availableTaxableInvested > 0 ? Math.max(0, 1 - availableTaxableCostBasis / availableTaxableInvested) : 0;
      const taxBeforeTaxable = currentTax;
      let adjustedDraw = 0;

      for (let i = 0; i < 3; i++) {
        const neededNet = Math.max(spendingNeed - netCashAfterTaxes, 0);
        adjustedDraw = solveGrossWithdrawal(availableTaxableInvested, neededNet, (gross) => {
          const gains = gross * gainRatio;
          const projectedIncome = buildIncomeState(ordinaryIncomeExSs, gains, socialSecurityIncome);
          const taxAfter = calcFederalIncomeTax(projectedIncome.taxOrdinaryIncome, gains, yearsFromStart, inflation).totalTax;
          return gross - (taxAfter - taxBeforeTaxable);
        });

        realizedTaxableGains = adjustedDraw * gainRatio;
        incomeState = buildIncomeState(ordinaryIncomeExSs, realizedTaxableGains, socialSecurityIncome);
        healthcare = estimateAnnualHealthcareCost(age, yearsFromStart, incomeState.acaIncome);
        const updatedSpendingNeed = baseSpending + healthcare.annualCost;
        if (Math.abs(updatedSpendingNeed - spendingNeed) < 1) {
          spendingNeed = updatedSpendingNeed;
          break;
        }
        spendingNeed = updatedSpendingNeed;
      }
    }

    return buildIncomeState(ordinaryIncomeExSs, realizedTaxableGains, socialSecurityIncome).acaIncome;
  }

  function getConversionAmount(
    currentAge: number,
    currentIraBal: number,
    strat: string,
    baselineTaxOrdinaryIncome: number,
    baselineOtherOrdinaryIncome: number,
    socialSecurityIncome: number,
    baselineAfterTaxCash: number,
    baselineTax: number,
    yearsFromStart: number,
    currentTaxableCash: number,
    currentTaxableInvested: number,
    currentTaxableCostBasis: number,
    currentRoth: number,
  ): number {
    if (currentAge > convEndAge || currentIraBal <= 0) return 0;
    const acaCliff = getAcaCliff(yearsFromStart, inflation, householdSize);
    const topOf12GrossIncome = getTopOfOrdinaryBracketGrossIncome(0.12, yearsFromStart, inflation);
    const topOf22GrossIncome = getTopOfOrdinaryBracketGrossIncome(0.22, yearsFromStart, inflation);
    if (strat === 'aca_safe') {
      if (currentAge < 65) {
        const baselineAcaIncome = baselineOtherOrdinaryIncome + socialSecurityIncome;
        if (baselineAcaIncome >= acaCliff) return 0;

        const baseSpending = annualSpending * Math.pow(1 + inflation, yearsFromStart);
        let low = 0;
        let high = currentIraBal;
        let best = 0;

        for (let i = 0; i < 28; i++) {
          const mid = (low + high) / 2;
          const projectedIncome = projectPre65AcaIncome(
            currentAge,
            yearsFromStart,
            baselineOtherOrdinaryIncome,
            socialSecurityIncome,
            baselineAfterTaxCash,
            baselineTax,
            baseSpending,
            currentTaxableCash,
            currentTaxableInvested,
            currentTaxableCostBasis,
            currentRoth + mid,
            mid,
          );

          if (projectedIncome <= acaCliff - 100) {
            best = mid;
            low = mid;
          } else {
            high = mid;
          }
        }

        return Math.min(best, currentIraBal);
      }
      return Math.min(Math.max(topOf22GrossIncome - baselineTaxOrdinaryIncome, 0), currentIraBal);
    }
    if (strat === 'fill_12') return Math.min(Math.max(topOf12GrossIncome - baselineTaxOrdinaryIncome, 0), currentIraBal);
    if (strat === 'fill_22') return Math.min(Math.max(topOf22GrossIncome - baselineTaxOrdinaryIncome, 0), currentIraBal);
    if (strat === 'maximize') {
      let bestAmt = 0;
      const step = 5000;
      const maxAmt = Math.min(currentIraBal, 300000);
      const acaBase = currentAge < 65 ? calcAcaSubsidyForYear(baselineOtherOrdinaryIncome + socialSecurityIncome, currentAge, yearsFromStart, inflation, householdSize) : null;
      const baseTaxAmt = calcProgressiveTax(baselineTaxOrdinaryIncome, yearsFromStart, inflation).tax;
      for (let amt = step; amt <= maxAmt; amt += step) {
        const projectedTaxOrdinaryIncome = buildIncomeState(baselineOtherOrdinaryIncome + amt, 0, socialSecurityIncome).taxOrdinaryIncome;
        const tax = calcProgressiveTax(projectedTaxOrdinaryIncome, yearsFromStart, inflation).tax - baseTaxAmt;
        const aca = currentAge < 65 ? calcAcaSubsidyForYear(baselineOtherOrdinaryIncome + socialSecurityIncome + amt, currentAge, yearsFromStart, inflation, householdSize) : null;
        const subLost = (acaBase?.subsidy || 0) - (aca?.subsidy || 0);
        const effRate = (tax + subLost) / amt;
        if (effRate < 0.30) bestAmt = amt;
      }
      return bestAmt;
    }
    return 0;
  }

  function solveGrossWithdrawal(
    maxGross: number,
    requiredNet: number,
    netFromGross: (gross: number) => number,
  ): number {
    if (maxGross <= 0 || requiredNet <= 0) return 0;
    if (netFromGross(maxGross) <= requiredNet) return maxGross;

    let low = 0;
    let high = maxGross;
    for (let i = 0; i < 32; i++) {
      const mid = (low + high) / 2;
      if (netFromGross(mid) >= requiredNet) high = mid;
      else low = mid;
    }
    return high;
  }

  function normalizeShortfall(shortfall: number): number {
    return shortfall > 1 ? shortfall : 0;
  }

  function simulateLifetime(doConvert: boolean) {
    let ira = iraBalance;
    let rothExisting = rothBal;
    let rothConverted = 0;
    let taxableCash = taxableCashBal;
    let taxableInvested = taxableInvestedBal;
    let taxableCostBasis = taxableBasis;
    let totalTaxPaid = 0;
    let totalSubsidyReceived = 0;
    let totalFundedExpenses = 0;
    let totalHealthcarePaid = 0;
    let ranOutAge: number | null = null;
    const years: Array<{
      age: number;
      convAmt: number;
      taxIncome: number;
      convTax: number;
      taxesPaid: number;
      rmd: number;
      acaSub: number;
      acaCliff: number;
      acaIncome: number;
      baseSpending: number;
      healthcareCost: number;
      expensesNeed: number;
      yieldFunding: number;
      ssFunding: number;
      rmdFunding: number;
      taxableFunding: number;
      iraFunding: number;
      rothFunding: number;
      spentThisYear: number;
      ira: number;
      roth: number;
      taxable: number;
      totalWealth: number;
      onMedicare: boolean;
      overCliff: boolean;
    }> = [];

    for (let age = startAge; age < lifeExp; age++) {
      const yearsFromStart = age - startAge;
      const inflatedSpending = annualSpending * Math.pow(1 + inflation, yearsFromStart);
      const ssThisYear = age >= 67 ? ssIncome * Math.pow(1 + inflation, age - startAge) : 0;
      const onMedicare = age >= 65;
      const acaCliff = getAcaCliff(yearsFromStart, inflation, householdSize);
      let rmd = 0;
      if (age >= 73) {
        const factor = getRmdFactor(age) || 10;
        rmd = ira / factor;
      }

      const currentRebalancedMix = rebalanceInvestedAccounts(
        {
          taxable: Math.max(taxableInvested, 0),
          ira: Math.max(ira, 0),
          roth: Math.max(rothExisting + rothConverted, 0),
        },
        investedTargetMix,
      );
      const taxableInvestedYield = estimateAccountYieldFromBalances(currentRebalancedMix, 'taxable') / 100;
      const recurringTaxableIncome = (taxableCash * taxableCashYield) + (taxableInvested * taxableInvestedYield);
      const baselineOtherOrdinaryIncome = earnedIncome + recurringTaxableIncome + rmd;
      const baselineIncomeState = buildIncomeState(baselineOtherOrdinaryIncome, 0, ssThisYear);
      const baselineCashIncome = baselineOtherOrdinaryIncome + ssThisYear;
      const baselineTax = calcFederalIncomeTax(baselineIncomeState.taxOrdinaryIncome, 0, yearsFromStart, inflation).totalTax;
      const baselineAfterTaxCash = baselineCashIncome - baselineTax;
      const taxableGainRatio = taxableInvested > 0 ? Math.max(0, 1 - taxableCostBasis / taxableInvested) : 0;
      const baselineHealthcare = estimateAnnualHealthcareCost(
        age,
        yearsFromStart,
        onMedicare ? baselineIncomeState.medicareIncome : baselineIncomeState.acaIncome,
      ).annualCost;
      const baselineShortfall = Math.max(inflatedSpending + baselineHealthcare - baselineAfterTaxCash, 0);
      const estimatedCashDraw = Math.min(baselineShortfall, taxableCash);
      const estimatedInvestedNeed = Math.max(baselineShortfall - estimatedCashDraw, 0);
      const currentRoth = rothExisting + rothConverted;
      const convAmt = doConvert ? getConversionAmount(
        age,
        ira,
        strategy,
        baselineIncomeState.taxOrdinaryIncome,
        baselineOtherOrdinaryIncome,
        ssThisYear,
        baselineAfterTaxCash,
        baselineTax,
        yearsFromStart,
        taxableCash,
        taxableInvested,
        taxableCostBasis,
        currentRoth,
      ) : 0;
      let ordinaryIncomeExSs = baselineOtherOrdinaryIncome + convAmt;
      let realizedTaxableGains = 0;
      let currentIncomeState = buildIncomeState(ordinaryIncomeExSs, 0, ssThisYear);
      let taxIncome = currentIncomeState.taxIncome;
      let acaIncome = currentIncomeState.acaIncome;
      let currentTax = calcFederalIncomeTax(currentIncomeState.taxOrdinaryIncome, 0, yearsFromStart, inflation).totalTax;
      const convTax = currentTax - baselineTax;
      let taxesPaidThisYear = currentTax;
      let healthcare = estimateAnnualHealthcareCost(age, yearsFromStart, onMedicare ? currentIncomeState.medicareIncome : acaIncome);
      let acaSub = healthcare.acaSub;
      const baselineFundingAvailable = Math.max(baselineAfterTaxCash - convTax, 0);
      const rmdShareOfBaselineCashIncome = baselineCashIncome > 0 ? rmd / baselineCashIncome : 0;
      const ssFundingAvailable = baselineCashIncome > 0
        ? baselineFundingAvailable * (ssThisYear / baselineCashIncome)
        : 0;
      const rmdFundingAvailable = baselineCashIncome > 0
        ? baselineFundingAvailable * rmdShareOfBaselineCashIncome
        : 0;
      let taxableFunding = 0;
      let iraFunding = 0;
      let rothFunding = 0;

      ira -= convAmt;
      rothConverted += convAmt;
      ira -= rmd;

      let spendingNeed = inflatedSpending + healthcare.annualCost;
      let netCashAfterTaxes = baselineAfterTaxCash - convTax;
      let spentThisYear = Math.max(Math.min(netCashAfterTaxes, spendingNeed), 0);
      let remaining = normalizeShortfall(spendingNeed - spentThisYear);
      for (let solverPass = 0; solverPass < 8 && remaining > 0; solverPass++) {
        const startRemaining = remaining;
        const startSpent = spentThisYear;
        const startAssets = taxableCash + taxableInvested + ira + rothExisting + rothConverted;

        if (remaining > 0 && taxableCash > 0) {
          const cashDraw = Math.min(remaining, taxableCash);
          taxableCash -= cashDraw;
          taxableFunding += cashDraw;
          netCashAfterTaxes += cashDraw;
          spentThisYear = Math.max(Math.min(netCashAfterTaxes, spendingNeed), 0);
          remaining = normalizeShortfall(spendingNeed - spentThisYear);
        }

        let roth = rothExisting + rothConverted;
        if (remaining > 0 && strategy === 'aca_safe' && age < 65 && roth > 0) {
          const draw = Math.min(remaining, roth);
          const fromConverted = Math.min(draw, rothConverted);
          rothConverted -= fromConverted;
          rothExisting -= (draw - fromConverted);
          rothFunding += draw;
          netCashAfterTaxes += draw;
          spentThisYear = Math.max(Math.min(netCashAfterTaxes, spendingNeed), 0);
          remaining = normalizeShortfall(spendingNeed - spentThisYear);
        }

        if (remaining > 0 && taxableInvested > 0) {
          const gainRatio = taxableInvested > 0 ? Math.max(0, 1 - taxableCostBasis / taxableInvested) : 0;
          const taxBeforeTaxable = currentTax;
          let adjustedDraw = 0;

          for (let i = 0; i < 3; i++) {
            const neededNet = Math.max(spendingNeed - netCashAfterTaxes, 0);
            adjustedDraw = solveGrossWithdrawal(taxableInvested, neededNet, (gross) => {
              const gains = gross * gainRatio;
              const projectedIncomeState = buildIncomeState(ordinaryIncomeExSs, gains, ssThisYear);
              const taxAfter = calcFederalIncomeTax(projectedIncomeState.taxOrdinaryIncome, gains, yearsFromStart, inflation).totalTax;
              return gross - (taxAfter - taxBeforeTaxable);
            });

            realizedTaxableGains = adjustedDraw * gainRatio;
            currentIncomeState = buildIncomeState(ordinaryIncomeExSs, realizedTaxableGains, ssThisYear);
            taxIncome = currentIncomeState.taxIncome;
            acaIncome = currentIncomeState.acaIncome;
            healthcare = estimateAnnualHealthcareCost(age, yearsFromStart, onMedicare ? currentIncomeState.medicareIncome : acaIncome);
            acaSub = healthcare.acaSub;
            const updatedSpendingNeed = inflatedSpending + healthcare.annualCost;
            if (Math.abs(updatedSpendingNeed - spendingNeed) < 1) {
              spendingNeed = updatedSpendingNeed;
              break;
            }
            spendingNeed = updatedSpendingNeed;
          }

          const taxAfterTaxable = calcFederalIncomeTax(currentIncomeState.taxOrdinaryIncome, realizedTaxableGains, yearsFromStart, inflation).totalTax;
          const ltcgTax = taxAfterTaxable - taxBeforeTaxable;
          taxableCostBasis -= adjustedDraw * (1 - gainRatio);
          taxableInvested -= adjustedDraw;
          currentTax = taxAfterTaxable;
          taxesPaidThisYear = currentTax;
          taxableFunding += adjustedDraw - ltcgTax;
          netCashAfterTaxes += adjustedDraw - ltcgTax;
          spentThisYear = Math.max(Math.min(netCashAfterTaxes, spendingNeed), 0);
          remaining = normalizeShortfall(spendingNeed - spentThisYear);
        }

        if (remaining > 0 && ira > 0) {
          const taxBeforeIra = currentTax;
          const draw = solveGrossWithdrawal(ira, remaining, (gross) => {
            const projectedIncomeState = buildIncomeState(ordinaryIncomeExSs + gross, realizedTaxableGains, ssThisYear);
            const taxAfter = calcFederalIncomeTax(projectedIncomeState.taxOrdinaryIncome, realizedTaxableGains, yearsFromStart, inflation).totalTax;
            return gross - (taxAfter - taxBeforeIra);
          });
          const postIraIncomeState = buildIncomeState(ordinaryIncomeExSs + draw, realizedTaxableGains, ssThisYear);
          const taxAfterIra = calcFederalIncomeTax(postIraIncomeState.taxOrdinaryIncome, realizedTaxableGains, yearsFromStart, inflation).totalTax;
          const drawTax = taxAfterIra - taxBeforeIra;
          ira -= draw;
          ordinaryIncomeExSs += draw;
          currentIncomeState = postIraIncomeState;
          taxIncome = currentIncomeState.taxIncome;
          acaIncome = currentIncomeState.acaIncome;
          currentTax = taxAfterIra;
          taxesPaidThisYear = currentTax;
          healthcare = estimateAnnualHealthcareCost(age, yearsFromStart, onMedicare ? currentIncomeState.medicareIncome : acaIncome);
          acaSub = healthcare.acaSub;
          spendingNeed = inflatedSpending + healthcare.annualCost;
          iraFunding += draw - drawTax;
          netCashAfterTaxes += draw - drawTax;
          spentThisYear = Math.max(Math.min(netCashAfterTaxes, spendingNeed), 0);
          remaining = normalizeShortfall(spendingNeed - spentThisYear);
        }

        roth = rothExisting + rothConverted;
        if (remaining > 0 && roth > 0) {
          const draw = Math.min(remaining, roth);
          const fromConverted = Math.min(draw, rothConverted);
          rothConverted -= fromConverted;
          rothExisting -= (draw - fromConverted);
          rothFunding += draw;
          netCashAfterTaxes += draw;
          spentThisYear = Math.max(Math.min(netCashAfterTaxes, spendingNeed), 0);
          remaining = normalizeShortfall(spendingNeed - spentThisYear);
        }

        const endAssets = taxableCash + taxableInvested + ira + rothExisting + rothConverted;
        const noProgress = Math.abs(remaining - startRemaining) < 1
          && Math.abs(spentThisYear - startSpent) < 1
          && Math.abs(endAssets - startAssets) < 1;
        if (noProgress) break;
      }

      const liquidatableAssetsRemaining = taxableCash + taxableInvested + ira + rothExisting + rothConverted;
      if (remaining > 0 && liquidatableAssetsRemaining <= 1 && ranOutAge === null) ranOutAge = age;

      const cashSurplus = Math.max(netCashAfterTaxes - spentThisYear, 0);
      if (cashSurplus > 0) {
        taxableCash += cashSurplus;
      }

      const healthcarePaidThisYear = Math.min(spendingNeed - inflatedSpending, spentThisYear);

      totalTaxPaid += taxesPaidThisYear;
      totalSubsidyReceived += acaSub;
      totalFundedExpenses += spentThisYear;
      totalHealthcarePaid += healthcarePaidThisYear;
      const totalBaselineFunding = Math.max(
        Math.min(spentThisYear - taxableFunding - iraFunding - rothFunding, baselineFundingAvailable),
        0,
      );
      const ssFunding = Math.max(Math.min(totalBaselineFunding, ssFundingAvailable), 0);
      const rmdFunding = Math.max(Math.min(totalBaselineFunding - ssFunding, rmdFundingAvailable), 0);
      const yieldFunding = Math.max(totalBaselineFunding - ssFunding - rmdFunding, 0);

      const endOfYearRebalancedMix = rebalanceInvestedAccounts(
        {
          taxable: Math.max(taxableInvested, 0),
          ira: Math.max(ira, 0),
          roth: Math.max(rothExisting + rothConverted, 0),
        },
        investedTargetMix,
      );
      const taxableInvestedGrowth = (taxableReturnOverride
        ? taxableGrowthPct
        : estimateAccountReturnFromBalances(endOfYearRebalancedMix, 'taxable')) / 100;
      const iraGrowth = (iraReturnOverride
        ? iraGrowthPct
        : estimateAccountReturnFromBalances(endOfYearRebalancedMix, 'ira')) / 100;
      const rothGrowth = (rothReturnOverride
        ? rothGrowthPct
        : estimateAccountReturnFromBalances(endOfYearRebalancedMix, 'roth')) / 100;

      ira = Math.max(ira, 0) * (1 + iraGrowth);
      const rothTotalBeforeGrowth = Math.max(rothExisting, 0) + Math.max(rothConverted, 0);
      const rothTotalAfterGrowth = rothTotalBeforeGrowth * (1 + rothGrowth);
      if (rothTotalBeforeGrowth > 0) {
        const rothGrowthFactor = rothTotalAfterGrowth / rothTotalBeforeGrowth;
        rothExisting = Math.max(rothExisting, 0) * rothGrowthFactor;
        rothConverted = Math.max(rothConverted, 0) * rothGrowthFactor;
      } else {
        rothExisting = 0;
        rothConverted = 0;
      }
      taxableCash = Math.max(taxableCash, 0) * (1 + taxableCashGrowth);
      taxableInvested = Math.max(taxableInvested, 0) * (1 + taxableInvestedGrowth);
      taxableCostBasis = Math.max(taxableCostBasis, 0) * (1 + taxableInvestedGrowth * 0.3);
      const roth = rothExisting + rothConverted;
      const endingTaxable = taxableCash + taxableInvested;

      years.push({
        age,
        convAmt,
        taxIncome,
        convTax,
        taxesPaid: taxesPaidThisYear,
        rmd,
        acaSub,
        acaCliff,
        acaIncome,
        baseSpending: inflatedSpending,
        healthcareCost: healthcare.annualCost,
        expensesNeed: spendingNeed,
        yieldFunding,
        ssFunding,
        rmdFunding,
        taxableFunding,
        iraFunding,
        rothFunding,
        spentThisYear,
        ira,
        roth,
        taxable: endingTaxable,
        totalWealth: ira + roth + endingTaxable,
        onMedicare,
        overCliff: !onMedicare && acaIncome > acaCliff,
      });
    }

    const endOfLifeWealth = years.length > 0 ? years[years.length - 1].totalWealth : ira + rothExisting + rothConverted + taxableCash + taxableInvested;
    const finalYear = years[years.length - 1];
    const finalIra = finalYear ? finalYear.ira : ira;
    const heirWithdrawalYears = 10;
    const annualInheritedIraWithdrawal = finalIra / heirWithdrawalYears;
    const estimatedHeirTax = annualInheritedIraWithdrawal > 0
      ? calcProgressiveTax(annualInheritedIraWithdrawal, lifeExp - startAge, inflation).tax * heirWithdrawalYears
      : 0;
    return {
      years,
      totalTaxPaid,
      totalSubsidyReceived,
      totalFundedExpenses,
      totalHealthcarePaid,
      ranOutAge,
      endOfLifeWealth,
      finalIra,
      finalRoth: finalYear ? finalYear.roth : rothExisting + rothConverted,
      finalTaxable: finalYear ? finalYear.taxable : taxableCash + taxableInvested,
      estimatedHeirTax,
    };
  }

  const withConv = simulateLifetime(true);
  const noConv = simulateLifetime(false);
  const healthcareDiff = withConv.totalHealthcarePaid - noConv.totalHealthcarePaid;
  const taxDiff = withConv.totalTaxPaid - noConv.totalTaxPaid;
  const subsidyDiff = withConv.totalSubsidyReceived - noConv.totalSubsidyReceived;
  const wealthDiff = withConv.endOfLifeWealth - noConv.endOfLifeWealth;
  const recommendation = recommendRothConversion(wealthDiff, taxDiff, withConv.ranOutAge, noConv.ranOutAge);
  const shouldConvert = recommendation.action === 'convert';

  const strategyDesc: Record<string, string> = {
    aca_safe: 'Stays below the ACA cliff (400% FPL) before 65, then fills 22% bracket.',
    fill_12: 'Fills the 12% tax bracket each year using inflation-adjusted thresholds.',
    fill_22: 'Fills the 22% tax bracket each year using inflation-adjusted thresholds.',
    maximize: 'Converts as much as possible while effective rate stays under 30%.',
  };

  function formatFunding(year: {
    yieldFunding: number;
    ssFunding: number;
    rmdFunding: number;
    taxableFunding: number;
    iraFunding: number;
    rothFunding: number;
  }): string {
    const fmtCoMoney = (amount: number): string => {
      const abs = Math.abs(amount);
      if (abs > 0 && abs < 1000) return `${amount < 0 ? '-<$1k' : '<$1k'}`;
      return `${amount < 0 ? '-$' : '$'}${fmtK(abs)}`;
    };

    const parts: string[] = [];
    if (year.ssFunding > 1) parts.push(`SS ${fmtCoMoney(year.ssFunding)}`);
    if (year.rmdFunding > 1) parts.push(`RMD ${fmtCoMoney(year.rmdFunding)}`);
    if (year.yieldFunding > 1) parts.push(`Yield ${fmtCoMoney(year.yieldFunding)}`);
    if (year.taxableFunding > 1) parts.push(`Taxable ${fmtCoMoney(year.taxableFunding)}`);
    if (year.iraFunding > 1) parts.push(`IRA ${fmtCoMoney(year.iraFunding)}`);
    if (year.rothFunding > 1) parts.push(`Roth ${fmtCoMoney(year.rothFunding)}`);
    return parts.length > 0 ? parts.join('<br>') : '—';
  }

  function fmtCoMoney(amount: number): string {
    const abs = Math.abs(amount);
    if (abs > 0 && abs < 1000) return `${amount < 0 ? '-<$1k' : '<$1k'}`;
    return `${amount < 0 ? '-$' : '$'}${fmtK(abs)}`;
  }

  function fmtAbsCoMoney(amount: number): string {
    return fmtCoMoney(Math.abs(amount));
  }

  const wealthDirection = wealthDiff > 0 ? 'higher' : wealthDiff < 0 ? 'lower' : 'about the same';
  const taxDirection = taxDiff < 0 ? 'lower' : taxDiff > 0 ? 'higher' : 'about the same';
  const recommendationTitle = shouldConvert ? 'Convert' : 'Do not convert';
  const recommendationToneClass = recommendation.tone === 'positive'
    ? 'positive'
    : recommendation.tone === 'negative'
      ? 'negative'
      : 'neutral';
  const recommendationTitleColor = recommendation.tone === 'positive'
    ? 'var(--accent)'
    : recommendation.tone === 'negative'
      ? 'var(--red)'
      : 'var(--text)';
  const recommendationWhy = recommendation.driver === 'depletion'
    ? shouldConvert
      ? `Conversions keep the plan funded longer${noConv.ranOutAge !== null ? ` by avoiding depletion at age ${noConv.ranOutAge}` : ''}.`
      : `Conversions deplete the plan earlier${withConv.ranOutAge !== null ? ` at age ${withConv.ranOutAge}` : ''}, so they are not preferred even if taxes are lower.`
    : recommendation.driver === 'wealth'
      ? Math.abs(wealthDiff) <= 1000
        ? `Modeled end-of-life wealth is roughly flat. Lifetime taxes are ${taxDirection}${taxDiff === 0 ? '' : ` by ${fmtAbsCoMoney(taxDiff)}`}.`
        : `Modeled end-of-life wealth is ${wealthDirection} by ${fmtAbsCoMoney(wealthDiff)} with conversions. Lifetime taxes are ${taxDirection}${taxDiff === 0 ? '' : ` by ${fmtAbsCoMoney(taxDiff)}`}.`
      : `End-of-life wealth is roughly flat, but lifetime taxes are ${taxDirection}${taxDiff === 0 ? '' : ` by ${fmtAbsCoMoney(taxDiff)}`} with conversions.`;
  const recommendationSecondary = subsidyDiff < -1000
    ? `A loss of ${fmtAbsCoMoney(subsidyDiff)} in ACA subsidies is part of the drag.`
    : subsidyDiff > 1000
      ? `The strategy also improves ACA subsidies by ${fmtAbsCoMoney(subsidyDiff)}.`
      : '';

  function renderScenarioTable(
    title: string,
    result: typeof withConv,
  ): string {
    return `
      <div class="te-section-title" style="margin-top:1rem;">${title}</div>
      <div style="max-height:420px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;">
        <table class="co-sweep-table">
          <thead><tr>
            <th style="text-align:left">Age</th>
            <th>Convert</th>
            <th>Tax Income</th>
            <th>ACA Income</th>
            <th>ACA Cliff</th>
            <th>Base Spending</th>
            <th>Healthcare</th>
            <th>Expenses</th>
            <th>RMD</th>
            <th>Conv Tax</th>
            <th>Total Tax</th>
            <th>ACA Sub</th>
            <th>Funding</th>
            <th>IRA</th>
            <th>Roth</th>
            <th>Taxable</th>
            <th>Wealth</th>
          </tr></thead>
          <tbody>${result.years.map((year) => `
            <tr class="${year.overCliff ? 'co-cliff' : ''}" style="${year.age === 65 ? 'border-top:2px solid var(--blue);' : ''}${year.age === 73 ? 'border-top:2px solid var(--orange);' : ''}">
              <td>${year.age}${year.onMedicare ? '*' : ''}${year.age >= 73 ? '+' : ''}</td>
              <td style="color:${year.convAmt > 0 ? 'var(--accent)' : 'var(--muted)'}">${fmtCoMoney(year.convAmt)}</td>
              <td>${fmtCoMoney(year.taxIncome)}</td>
              <td>${year.onMedicare ? '—' : fmtCoMoney(year.acaIncome)}</td>
              <td>${year.onMedicare ? '—' : fmtCoMoney(year.acaCliff)}</td>
              <td>${fmtCoMoney(year.baseSpending)}</td>
              <td>${fmtCoMoney(year.healthcareCost)}</td>
              <td>${fmtCoMoney(year.expensesNeed)}</td>
              <td>${fmtCoMoney(year.rmd)}</td>
              <td style="color:var(--red)">${fmtCoMoney(year.convTax)}</td>
              <td style="color:var(--red)">${fmtCoMoney(year.taxesPaid)}</td>
              <td style="color:${year.acaSub > 0 ? 'var(--accent)' : 'var(--muted)'}">${fmtCoMoney(year.acaSub)}</td>
              <td>${formatFunding(year)}</td>
              <td>${fmtCoMoney(year.ira)}</td>
              <td>${fmtCoMoney(year.roth)}</td>
              <td>${fmtCoMoney(year.taxable)}</td>
              <td>${fmtCoMoney(year.totalWealth)}</td>
            </tr>
          `).join('')}</tbody>
        </table>
      </div>`;
  }

  if (allowConversion) {
    $(`${prefix}Results`).innerHTML = `
      <div class="co-optimal-callout ${recommendationToneClass}">
        <div class="co-optimal-title" style="color:${recommendationTitleColor}">
          ${recommendationTitle}
        </div>
        <div class="co-optimal-sub">
          ${recommendationWhy}
          ${recommendationSecondary}
          With conversions: ${fmtCoMoney(withConv.endOfLifeWealth)} ending wealth and ${fmtCoMoney(withConv.totalTaxPaid)} lifetime taxes.
          Without conversions: ${fmtCoMoney(noConv.endOfLifeWealth)} ending wealth and ${fmtCoMoney(noConv.totalTaxPaid)} lifetime taxes.
        </div>
      </div>
      <div class="co-result-grid">
        <div class="co-cost-stack">
          <h4>With Conversions</h4>
          <div class="co-line"><span class="label">Total converted to Roth</span><span class="val">${fmtCoMoney(withConv.years.reduce((sum, y) => sum + y.convAmt, 0))}</span></div>
          <div class="co-line"><span class="label">Total taxes paid (lifetime)</span><span class="val red">${fmtCoMoney(withConv.totalTaxPaid)}</span></div>
          <div class="co-line"><span class="label">ACA subsidies received</span><span class="val green">${fmtCoMoney(withConv.totalSubsidyReceived)}</span></div>
          <div class="co-line"><span class="label">Healthcare paid</span><span class="val">${fmtCoMoney(withConv.totalHealthcarePaid)}</span></div>
          <div class="co-line total"><span class="label">End-of-life wealth</span><span class="val ${shouldConvert ? 'green' : ''}" style="font-size:1.05rem;">${fmtCoMoney(withConv.endOfLifeWealth)}</span></div>
          <div class="co-line"><span class="label">Roth left (tax free)</span><span class="val">${fmtCoMoney(withConv.finalRoth)}</span></div>
          <div class="co-line"><span class="label">Taxable left</span><span class="val">${fmtCoMoney(withConv.finalTaxable)}</span></div>
          <div class="co-line"><span class="label">IRA left (ordinary income)</span><span class="val">${fmtCoMoney(withConv.finalIra)}</span></div>
          <div class="co-line"><span class="label">Taxes paid by heirs</span><span class="val red">${fmtCoMoney(withConv.estimatedHeirTax)}</span></div>
          ${withConv.ranOutAge ? `<div class="co-line"><span class="label">Money runs out</span><span class="val red">Age ${withConv.ranOutAge}</span></div>` : ''}
        </div>
        <div class="co-cost-stack">
          <h4>Without Conversions</h4>
          <div class="co-line"><span class="label">Total converted to Roth</span><span class="val">$0</span></div>
          <div class="co-line"><span class="label">Total taxes paid (lifetime)</span><span class="val red">${fmtCoMoney(noConv.totalTaxPaid)}</span></div>
          <div class="co-line"><span class="label">ACA subsidies received</span><span class="val green">${fmtCoMoney(noConv.totalSubsidyReceived)}</span></div>
          <div class="co-line"><span class="label">Healthcare paid</span><span class="val">${fmtCoMoney(noConv.totalHealthcarePaid)}</span></div>
          <div class="co-line total"><span class="label">End-of-life wealth</span><span class="val ${!shouldConvert ? 'green' : ''}" style="font-size:1.05rem;">${fmtCoMoney(noConv.endOfLifeWealth)}</span></div>
          <div class="co-line"><span class="label">Roth left (tax free)</span><span class="val">${fmtCoMoney(noConv.finalRoth)}</span></div>
          <div class="co-line"><span class="label">Taxable left</span><span class="val">${fmtCoMoney(noConv.finalTaxable)}</span></div>
          <div class="co-line"><span class="label">IRA left (ordinary income)</span><span class="val">${fmtCoMoney(noConv.finalIra)}</span></div>
          <div class="co-line"><span class="label">Taxes paid by heirs</span><span class="val red">${fmtCoMoney(noConv.estimatedHeirTax)}</span></div>
          ${noConv.ranOutAge ? `<div class="co-line"><span class="label">Money runs out</span><span class="val red">Age ${noConv.ranOutAge}</span></div>` : ''}
        </div>
      </div>
      <div class="co-result-grid" style="margin-top:0;">
        <div class="co-cost-stack" style="background:${shouldConvert ? 'var(--accent-dim)' : recommendation.tone === 'negative' ? '#7f1d1d' : 'var(--surface)'};border-color:${shouldConvert ? 'rgba(34,197,94,0.3)' : recommendation.tone === 'negative' ? 'rgba(239,68,68,0.3)' : 'var(--border)'};">
          <div class="co-line" style="border:none;font-size:0.95rem;">
            <span class="label" style="color:var(--text);font-weight:700;">Recommendation</span>
            <span class="val" style="font-size:1.1rem;color:${recommendationTitleColor}">${recommendationTitle}</span>
          </div>
        </div>
        <div class="co-cost-stack">
          <div class="co-line" style="border:none;font-size:0.85rem;">
            <span class="label">Healthcare paid difference</span>
            <span class="val" style="color:${healthcareDiff <= 0 ? 'var(--accent)' : 'var(--red)'}">${healthcareDiff >= 0 ? '+' : ''}${fmtCoMoney(healthcareDiff)}</span>
          </div>
          <div class="co-line" style="border:none;font-size:0.85rem;">
            <span class="label">Tax difference</span>
            <span class="val" style="color:${taxDiff > 0 ? 'var(--red)' : 'var(--accent)'}">${taxDiff > 0 ? '+' : ''}${fmtCoMoney(taxDiff)}</span>
          </div>
          <div class="co-line" style="border:none;font-size:0.85rem;">
            <span class="label">Subsidy difference</span>
            <span class="val" style="color:${subsidyDiff < 0 ? 'var(--red)' : 'var(--accent)'}">${subsidyDiff >= 0 ? '+' : ''}${fmtCoMoney(subsidyDiff)}</span>
          </div>
          <div class="co-line" style="border:none;font-size:0.85rem;">
            <span class="label">End-of-life wealth difference</span>
            <span class="val" style="color:${wealthDiff >= 0 ? 'var(--accent)' : 'var(--red)'}">${wealthDiff >= 0 ? '+' : ''}${fmtCoMoney(wealthDiff)}</span>
          </div>
        </div>
      </div>
      <div class="te-section-title">Year-by-Year Scenarios</div>
      <p style="font-size:0.8rem;color:var(--muted);margin-bottom:0.75rem;">
        ${strategyDesc[strategy]}
        Both scenarios start with $${fmt(annualSpending)}/yr spending, inflated ${fmtD(inflation * 100, 1)}% annually, plus healthcare costs.
        Withdrawal order: RMDs first, then taxable (long-term capital gains brackets), then IRA (ordinary income brackets), then Roth/HSA (modeled as tax-free).
        Invested growth assumptions come from a yearly rebalance back to your current portfolio mix, with tax-location preferences applied across taxable, IRA, and Roth/HSA. Taxable cash is modeled separately unless you override the return inputs above.
        Heir taxes assume a non-spouse heir withdraws the inherited IRA evenly over 10 years and pays ordinary federal income tax under the same tax table model.
        <br>* = Medicare (65+). + = RMDs begin (73+).
      </p>
      ${renderScenarioTable('With Conversions', withConv)}
      ${renderScenarioTable('Without Conversions', noConv)}`;
    return;
  }

  $(`${prefix}Results`).innerHTML = `
    <div class="co-optimal-callout neutral">
      <div class="co-optimal-title">Projected drawdown path without Roth conversions</div>
      <div class="co-optimal-sub">
        This view uses the same lifetime simulator as the Roth conversion calculator, but disables conversions and shows the standalone drawdown plan.
      </div>
    </div>
    <div class="co-result-grid">
      <div class="co-cost-stack">
        <h4>Drawdown Summary</h4>
        <div class="co-line"><span class="label">Total taxes paid (lifetime)</span><span class="val red">${fmtCoMoney(noConv.totalTaxPaid)}</span></div>
        <div class="co-line"><span class="label">ACA subsidies received</span><span class="val green">${fmtCoMoney(noConv.totalSubsidyReceived)}</span></div>
        <div class="co-line"><span class="label">Healthcare paid</span><span class="val">${fmtCoMoney(noConv.totalHealthcarePaid)}</span></div>
        <div class="co-line total"><span class="label">End-of-life wealth</span><span class="val" style="font-size:1.05rem;">${fmtCoMoney(noConv.endOfLifeWealth)}</span></div>
        ${noConv.ranOutAge ? `<div class="co-line"><span class="label">Money runs out</span><span class="val red">Age ${noConv.ranOutAge}</span></div>` : '<div class="co-line"><span class="label">Money runs out</span><span class="val green">No</span></div>'}
      </div>
    </div>
    <div class="te-section-title">Year-by-Year Drawdown</div>
    <p style="font-size:0.8rem;color:var(--muted);margin-bottom:0.75rem;">
      Starts with $${fmt(annualSpending)}/yr spending, inflated ${fmtD(inflation * 100, 1)}% annually, plus healthcare costs.
      Withdrawal order: RMDs first, then taxable (long-term capital gains brackets), then IRA (ordinary income brackets), then Roth/HSA (modeled as tax-free).
      <br>* = Medicare (65+). + = RMDs begin (73+).
    </p>
    ${renderScenarioTable('Drawdown Plan', noConv)}`;
}

function renderConversionOptimizer(): void {
  renderLifetimePlan('co', true);
}

function renderDrawdownPlan(): void {
  renderDrawdownScenarioBanner();
  renderLifetimePlan('dp', false);
}

function getLocalTickerDefaults(ticker: string): Partial<YieldCacheEntry> & { category?: CategoryKey } {
  const t = ticker.toUpperCase();
  const cached = yieldCache[t];
  if (cached) return cached;
  const holding = holdings.find((item) => item.ticker.toUpperCase() === t);
  if (!holding) return {};
  return {
    yield: holding.dividendYield,
    price: holding.price,
    name: holding.name,
    category: holding.category,
  };
}

function mergeFetchedTickerData(ticker: string, data: ReturnType<typeof emptySymbolLookupResult>): YieldCacheEntry {
  const t = ticker.toUpperCase();
  const existing = yieldCache[t];
  const localDefaults = getLocalTickerDefaults(t);
  return {
    yield: data.yield ?? existing?.yield ?? localDefaults?.yield ?? 0,
    price: data.price ?? existing?.price ?? localDefaults?.price ?? 0,
    name: data.name || existing?.name || localDefaults?.name || t,
    allocation: data.allocation || existing?.allocation || localDefaults?.allocation || COMPOSITE_FUNDS[t] || null,
    assetClass: data.assetClass || existing?.assetClass,
    etfCategory: data.etfCategory || existing?.etfCategory,
    detectedCategory: data.detectedCategory || existing?.detectedCategory || localDefaults.category,
    expenseRatio: data.expenseRatio ?? existing?.expenseRatio,
    dataSource: data.sources?.length ? data.sources.join(' + ') : existing?.dataSource,
    fetched: Date.now(),
  };
}

function getExpectedRefreshFields(ticker: string, name?: string | null): string[] {
  const expected = ['name', 'price', 'yield'];
  if (isLikelyFundTicker(ticker, name || null)) {
    expected.push('expense ratio');
    expected.push('classification');
  }
  return expected;
}

function getPresentRefreshFields(data: ReturnType<typeof emptySymbolLookupResult>): string[] {
  const present: string[] = [];
  if (data.name) present.push('name');
  if (data.price != null && data.price > 0) present.push('price');
  if (data.yield != null) present.push('yield');
  if (data.expenseRatio != null) present.push('expense ratio');
  if (data.allocation || data.assetClass || data.detectedCategory) present.push('classification');
  return present;
}

async function formatHttpFailure(resp: Response, label: string): Promise<string> {
  let detail = '';
  try {
    const text = (await resp.text()).trim();
    if (text) {
      const compact = text.replace(/\s+/g, ' ').slice(0, 180);
      detail = `: ${compact}`;
    }
  } catch {
    detail = '';
  }
  return `${label} (HTTP ${resp.status})${detail}`;
}

function formatIsoDate(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

async function fetchTickerData(
  ticker: string,
): Promise<{
  data: ReturnType<typeof emptySymbolLookupResult> | null;
  apiCalls: string[];
  missingFields: string[];
}> {
  const t = ticker.toUpperCase();
  if (CASH_TICKERS.has(t)) {
    const data = {
      yield: 4.5,
      price: 1,
      name: t,
      allocation: null,
      assetClass: null,
      etfCategory: null,
      detectedCategory: null,
      expenseRatio: null,
      sources: ['Built-in cash defaults'],
    };
    return { data, apiCalls: [], missingFields: [] };
  }

  const localDefaults = getLocalTickerDefaults(t);
  const likelyFund = isLikelyFundTicker(t, localDefaults.name || null);
  let merged = mergeSymbolLookupResults(emptySymbolLookupResult(), {
    yield: null,
    price: null,
    name: localDefaults?.name || null,
    allocation: COMPOSITE_FUNDS[t] || null,
    assetClass: null,
    etfCategory: null,
    detectedCategory: localDefaults.category || null,
    expenseRatio: localDefaults.expenseRatio ?? null,
  });
  const apiCalls: string[] = [];

  if (symbolApiKey) {
    try {
      const eodResp = await fetch(
        `${EODHD_API}/eod/${encodeURIComponent(`${t}.US`)}?api_token=${encodeURIComponent(symbolApiKey)}&fmt=json&from=${formatIsoDate(14)}`,
      );
      if (!eodResp.ok) {
        apiCalls.push(await formatHttpFailure(
          eodResp,
          eodResp.status === 402 || eodResp.status === 403 || eodResp.status === 429
            ? 'EODHD end-of-day price blocked by plan/quota'
            : 'EODHD end-of-day price',
        ));
      } else {
        const eodJson = await eodResp.json();
        merged = mergeSymbolLookupResults(merged, parseEodhdEodPrice(eodJson));
      }
    } catch (error) {
      apiCalls.push(`EODHD end-of-day price error: ${(error as Error).message}`);
    }
  }

  for (const type of ['e', 's']) {
    try {
      const resp = await fetch(`${SA_API}/${type}/${t}/overview`);
      if (!resp.ok) {
        apiCalls.push(await formatHttpFailure(resp, `Stock Analysis ${type}/overview`));
        continue;
      }
      const json = await resp.json();
      const d = json.data;
      if (!d) {
        apiCalls.push(`Stock Analysis ${type}/overview returned no data`);
        continue;
      }

      const parsed = parseStockAnalysisOverview(t, d);
      let price = parsed?.price ?? null;

      if (price === null && type === 's') {
        try {
          const historyResp = await fetch(`${SA_API}/${type}/${t}/history?p=daily&range=1D`);
          if (historyResp.ok) {
            const historyJson = await historyResp.json();
            if (historyJson.data?.length > 0) {
              price = historyJson.data[0].c;
            }
          } else {
            apiCalls.push(await formatHttpFailure(historyResp, `Stock Analysis ${type}/history`));
          }
        } catch (error) {
          apiCalls.push(`Stock Analysis ${type}/history error: ${(error as Error).message}`);
        }
      }
      merged = mergeSymbolLookupResults(merged, parsed, { ...parsed, price, sources: price != null && parsed?.price == null ? ['Stock Analysis history'] : parsed?.sources || [] });
    } catch (error) {
      apiCalls.push(`Stock Analysis ${type}/overview error: ${(error as Error).message}`);
      continue;
    }
  }

  if (!merged.allocation && isLikelyFundTicker(t, merged.name || localDefaults?.name || null)) {
    const queries = buildDealchartsQueries(t, merged.name || localDefaults?.name || null);
    for (const query of queries) {
      try {
        const searchResp = await fetch(`${DEALCHARTS_SEARCH_API}?query=${encodeURIComponent(query)}`);
        if (!searchResp.ok) {
          apiCalls.push(await formatHttpFailure(searchResp, `Dealcharts search "${query}"`));
          continue;
        }
        const searchJson = await searchResp.json();
        const result = pickDealchartsSearchResult(Array.isArray(searchJson) ? searchJson : [], t, merged.name || localDefaults?.name || null);
        if (!result?.facts_url) continue;

        const factsResp = await fetch(result.facts_url);
        if (!factsResp.ok) {
          apiCalls.push(await formatHttpFailure(factsResp, `Dealcharts facts "${query}"`));
          continue;
        }
        const factsJson = await factsResp.json();
        merged = mergeSymbolLookupResults(merged, parseDealchartsFundFacts(t, factsJson));
        if (merged.allocation || merged.name) break;
      } catch (error) {
        apiCalls.push(`Dealcharts lookup "${query}" error: ${(error as Error).message}`);
      }
    }
  }

  if (symbolApiKey && likelyFund && (merged.expenseRatio == null || merged.yield == null)) {
    apiCalls.push('EODHD free-key flow only requested end-of-day price; yield and expense ratio still depend on the public fallback sources');
  }

  if (!merged.detectedCategory) {
    const inferredCategory = inferCategoryFromTickerAndName(t, merged.name || localDefaults.name || null);
    if (inferredCategory) {
      merged = mergeSymbolLookupResults(merged, {
        yield: null,
        price: null,
        name: null,
        allocation: null,
        assetClass: null,
        etfCategory: null,
        detectedCategory: inferredCategory,
        expenseRatio: null,
        sources: ['Name-based classification fallback'],
      });
    }
  }

  const missingFields = getExpectedRefreshFields(t, merged.name || localDefaults.name || null)
    .filter((field) => !getPresentRefreshFields(merged).includes(field));

  if (hasSymbolLookupData(merged)) return { data: merged, apiCalls, missingFields };
  return { data: null, apiCalls, missingFields };
}

async function fetchSingleYield(ticker: string) {
  const { data } = await fetchTickerData(ticker);
  if (data) {
    yieldCache[ticker.toUpperCase()] = mergeFetchedTickerData(ticker, data);
    persistYieldCache();
  }
  return data;
}

async function fetchAllYields(statusEl?: HTMLElement | null): Promise<{
  total: number;
  updated: number;
  failed: number;
  successes: SymbolRefreshSuccess[];
  failures: SymbolRefreshFailure[];
}> {
  const tickers = [...new Set(holdings.map((h) => h.ticker.toUpperCase()))];
  let done = 0;
  let updated = 0;
  let failed = 0;
  const successes: SymbolRefreshSuccess[] = [];
  const failures: SymbolRefreshFailure[] = [];

  for (const ticker of tickers) {
    if (statusEl) statusEl.textContent = `Fetching ${ticker}... (${done}/${tickers.length})`;

    const result = await fetchTickerData(ticker);
    const apiCalls = result.apiCalls;
    const data = result.data;
    if (data) {
        const fields: string[] = [];
        if (data.yield != null) fields.push('yield');
        if (data.price != null && data.price > 0) fields.push('price');
        if (data.name) fields.push('name');
        if (data.assetClass) fields.push('asset class');
        if (data.detectedCategory) fields.push('category');
        if (data.allocation) fields.push('allocation split');
        if (data.expenseRatio != null) fields.push('expense ratio');
        yieldCache[ticker] = mergeFetchedTickerData(ticker, data);

        for (const h of holdings) {
          if (h.ticker.toUpperCase() === ticker) {
            if (data.yield != null) h.dividendYield = data.yield;
            if (data.price && data.price > 0) h.price = Math.round(data.price * 100) / 100;
            if (data.name && data.name.length > 2 && h.name === h.ticker) h.name = data.name;
            if (data.detectedCategory && !data.allocation) h.category = data.detectedCategory;
          }
        }
        updated++;
        successes.push({
          ticker,
          fields: fields.length > 0 ? fields : ['no new fields detected'],
          sources: data.sources || [],
        });
    }

    const hasIssues = !data || apiCalls.length > 0 || result.missingFields.length > 0;
    if (hasIssues) {
      failed++;
      failures.push({
        ticker,
        apiCalls: apiCalls.length > 0 ? apiCalls : ['No symbol data returned'],
        missingFields: result.missingFields,
      });
    }

    done++;
    if (done < tickers.length) {
      await new Promise((resolve) => window.setTimeout(resolve, 300));
    }
  }

  persistYieldCache();
  persist();
  renderAll();
  return { total: tickers.length, updated, failed, successes, failures };
}

async function runDataRefresh(buttonId: string, labelId: string, idleLabel: string): Promise<void> {
  if (holdings.length === 0) return;

  const btn = $(buttonId) as HTMLButtonElement;
  const label = $(labelId);
  btn.disabled = true;
  btn.style.opacity = '0.6';
  label.textContent = 'Fetching...';
  const startedAt = Date.now();

  try {
    const result = await fetchAllYields(label);
    lastRefreshReport = {
      startedAt,
      completedAt: Date.now(),
      ...result,
    };
    persistSymbolRefreshReport();
    renderSymbolRefreshReport();
    label.textContent = idleLabel;
    showImportToast(`${result.updated} populated${result.failed > 0 ? `, ${result.failed} failed` : ''} — symbol data refreshed`);
  } catch (error) {
    lastRefreshReport = {
      startedAt,
      completedAt: Date.now(),
      total: 0,
      updated: 0,
      failed: 1,
      successes: [],
      failures: [{ ticker: 'ALL', apiCalls: [(error as Error).message], missingFields: [] }],
    };
    persistSymbolRefreshReport();
    renderSymbolRefreshReport();
    label.textContent = idleLabel;
    showImportToast(`Fetch failed: ${(error as Error).message}`);
  } finally {
    btn.disabled = false;
    btn.style.opacity = '';
  }
}

function saveSymbolApiSettings(): void {
  const input = $('symbolApiKey') as HTMLInputElement;
  symbolApiKey = input.value.trim();
  localStorage.setItem(SYMBOL_API_KEY_STORAGE_KEY, symbolApiKey);
  renderSymbols();
  showImportToast(symbolApiKey ? 'Saved EODHD API key locally' : 'Removed EODHD API key');
}

function clearSymbolApiSettings(): void {
  symbolApiKey = '';
  localStorage.removeItem(SYMBOL_API_KEY_STORAGE_KEY);
  renderSymbols();
  showImportToast('Cleared EODHD API key');
}

function parseSymbolAllocationInput(value: string): Record<string, number> | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const aliases: Record<string, CategoryKey> = {
    us: 'us_stock',
    usstock: 'us_stock',
    us_stock: 'us_stock',
    usstocks: 'us_stock',
    intl: 'intl_stock',
    int: 'intl_stock',
    international: 'intl_stock',
    intlstock: 'intl_stock',
    intl_stock: 'intl_stock',
    bond: 'bond',
    bonds: 'bond',
    fixedincome: 'bond',
    fixed_income: 'bond',
    muni: 'muni',
    muni_bond: 'muni',
    municipal: 'muni',
    municipalbond: 'muni',
    reit: 'reit',
    reits: 'reit',
    realestate: 'reit',
    real_estate: 'reit',
    cash: 'cash',
    crypto: 'crypto',
    other: 'other',
  };

  const split: Partial<Record<CategoryKey, number>> = {};
  for (const rawPart of trimmed.split(/[\n,;]+/)) {
    const part = rawPart.trim();
    if (!part) continue;
    const match = part.match(/^([a-zA-Z _-]+)\s*(?:=|:)\s*([\d.]+)%?$/);
    if (!match) throw new Error(`Invalid split segment: "${part}"`);

    const rawKey = match[1].toLowerCase().replace(/[\s-]+/g, '_');
    const key = aliases[rawKey.replace(/_/g, '')] ?? aliases[rawKey] ?? (rawKey as CategoryKey);
    if (!(key in CATEGORIES)) throw new Error(`Unknown category in split: "${match[1]}"`);

    const pct = parseFloat(match[2]);
    if (!Number.isFinite(pct) || pct < 0) throw new Error(`Invalid percentage in split: "${part}"`);
    split[key] = pct;
  }

  const entries = Object.entries(split) as Array<[CategoryKey, number]>;
  if (entries.length === 0) return null;

  const total = entries.reduce((sum, [, pct]) => sum + pct, 0);
  if (total <= 0) throw new Error('Allocation split must total more than 0%.');

  const normalized: Record<string, number> = {};
  for (const [key, pct] of entries) normalized[key] = pct / total;
  return normalized;
}

function getSymbolCacheEntry(ticker: string): YieldCacheEntry {
  const upper = ticker.toUpperCase();
  const existing = yieldCache[upper];
  if (existing) return existing;

  const holding = holdings.find((item) => item.ticker.toUpperCase() === upper);
  const created: YieldCacheEntry = {
    yield: holding?.dividendYield ?? 0,
    price: holding?.price ?? 0,
    name: holding?.name || upper,
    allocation: null,
    detectedCategory: holding?.category,
    dataSource: 'Manual',
    fetched: 0,
  };
  yieldCache[upper] = created;
  return created;
}

function startSymbolEdit(ticker: string): void {
  editingSymbolTicker = ticker.toUpperCase();
  renderSymbols();
}

function cancelSymbolEdit(): void {
  editingSymbolTicker = null;
  renderSymbols();
}

function saveSymbolEdit(ticker: string): void {
  try {
    const upper = ticker.toUpperCase();
    const entry = getSymbolCacheEntry(upper);
    const name = $('symbolEditName').value.trim() || upper;
    const assetClass = $('symbolEditAssetClass').value.trim();
    const categoryValue = $('symbolEditCategory').value.trim() as CategoryKey | '';
    const allocationValue = $('symbolEditAllocation').value.trim();
    const yieldValue = $('symbolEditYield').value.trim();
    const expenseValue = $('symbolEditExpenseRatio').value.trim();

    const allocation = parseSymbolAllocationInput(allocationValue);
    const parsedYield = yieldValue ? parseFloat(yieldValue) : 0;
    const parsedExpense = expenseValue ? parseFloat(expenseValue) : null;

    if (!Number.isFinite(parsedYield) || parsedYield < 0) {
      throw new Error('Yield must be a non-negative number.');
    }
    if (parsedExpense != null && (!Number.isFinite(parsedExpense) || parsedExpense < 0)) {
      throw new Error('Expense ratio must be a non-negative number.');
    }

    entry.name = name;
    entry.assetClass = assetClass || undefined;
    entry.detectedCategory = categoryValue || undefined;
    entry.allocation = allocation;
    entry.yield = parsedYield;
    entry.expenseRatio = parsedExpense ?? undefined;
    entry.dataSource = 'Manual edit';
    yieldCache[upper] = entry;

    for (const holding of holdings) {
      if (holding.ticker.toUpperCase() !== upper) continue;
      holding.name = name;
      holding.dividendYield = parsedYield;
      if (categoryValue) holding.category = categoryValue;
      else if (allocation) holding.category = 'other';
    }

    editingSymbolTicker = null;
    persist();
    renderAll();
    showImportToast(`Saved symbol metadata for ${upper}`);
  } catch (error) {
    alert(`Failed to save symbol metadata: ${(error as Error).message}`);
  }
}

async function handleSymbolCatalogRefresh(): Promise<void> {
  await runDataRefresh('symbolRefreshBtn', 'symbolRefreshLabel', 'Refresh Symbol Data');
}

function openAddModal(): void {
  $('addModalTitle').textContent = 'Add Holding';
  $('hTicker').value = '';
  $('hName').value = '';
  $('hAccount').value = 'roth';
  $('hCategory').value = 'us_stock';
  $('hShares').value = '';
  $('hCostBasis').value = '';
  $('hPrice').value = '';
  $('hYield').value = '';
  $('hYieldHint').textContent = '';
  $('hEditIndex').value = '-1';
  $('addModal').classList.add('open');
}

function closeAddModal(): void {
  $('addModal').classList.remove('open');
}

function getHoldingIdentity(holding: Pick<Holding, 'ticker' | 'account' | 'brokerage' | 'accountNumber'>): string {
  return [
    holding.ticker.toUpperCase(),
    holding.account,
    (holding.brokerage || '').trim().toUpperCase(),
    (holding.accountNumber || '').trim(),
  ].join(':');
}

function editHolding(index: number): void {
  const h = holdings[index];
  $('addModalTitle').textContent = 'Edit Holding';
  $('hTicker').value = h.ticker;
  $('hName').value = h.name;
  $('hAccount').value = h.account;
  $('hCategory').value = h.category;
  $('hShares').value = String(h.shares);
  $('hCostBasis').value = String(h.costBasis);
  $('hPrice').value = String(h.price);
  $('hYield').value = h.dividendYield != null ? String(h.dividendYield) : '';
  $('hYieldHint').textContent = '';
  $('hEditIndex').value = String(index);
  $('addModal').classList.add('open');
}

function saveHolding(): void {
  const ticker = $('hTicker').value.toUpperCase().trim();
  const category = $('hCategory').value as CategoryKey;
  let yieldVal = parseFloat($('hYield').value);
  if (!Number.isFinite(yieldVal) || yieldVal < 0) {
    yieldVal = lookupYield(ticker) ?? estimateYieldByCategory(category);
  }

  const index = parseInt($('hEditIndex').value, 10);
  const existing = index >= 0 ? holdings[index] : null;

  const holding: Holding = {
    ticker,
    name: $('hName').value.trim(),
    account: $('hAccount').value as AccountType,
    brokerage: existing?.brokerage,
    category,
    shares: parseFloat($('hShares').value) || 0,
    costBasis: parseFloat($('hCostBasis').value) || 0,
    price: parseFloat($('hPrice').value) || 0,
    dividendYield: Math.round(yieldVal * 100) / 100,
    accountNumber: existing?.accountNumber,
  };

  if (!holding.ticker || holding.shares <= 0) return;

  if (index >= 0) holdings[index] = holding;
  else holdings.push(holding);

  persist();
  closeAddModal();
  renderAll();
}

function deleteHolding(index: number): void {
  holdings.splice(index, 1);
  persist();
  renderAll();
}

function openTargetModal(): void {
  $('tUS').value = String(targets.us_stock);
  $('tIntl').value = String(targets.intl_stock);
  $('tBond').value = String(targets.bond);
  $('tMuni').value = String(targets.muni || 0);
  $('tREIT').value = String(targets.reit);
  $('tCash').value = String(targets.cash);
  $('tCrypto').value = String(targets.crypto);
  $('tOther').value = String(targets.other);
  updateTargetSum();
  $('targetModal').classList.add('open');
}

function closeTargetModal(): void {
  $('targetModal').classList.remove('open');
}

function updateTargetSum(): void {
  const sum = ['tUS', 'tIntl', 'tBond', 'tMuni', 'tREIT', 'tCash', 'tCrypto', 'tOther']
    .reduce((total, id) => total + (parseFloat($(id).value) || 0), 0);
  const ok = Math.abs(sum - 100) < 0.1;
  $('targetSum').innerHTML = `Total: <span style="color:${ok ? 'var(--accent)' : 'var(--red)'}">${fmtD(sum, 1)}%</span>${ok ? '' : ' (must equal 100%)'}`;
}

function saveTargets(): void {
  const nextTargets = {
    us_stock: parseFloat($('tUS').value) || 0,
    intl_stock: parseFloat($('tIntl').value) || 0,
    bond: parseFloat($('tBond').value) || 0,
    muni: parseFloat($('tMuni').value) || 0,
    reit: parseFloat($('tREIT').value) || 0,
    cash: parseFloat($('tCash').value) || 0,
    crypto: parseFloat($('tCrypto').value) || 0,
    other: parseFloat($('tOther').value) || 0,
  };
  const sum = Object.values(nextTargets).reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 100) > 0.5) return;
  setTargets(nextTargets as Record<CategoryKey, number>);
  persist();
  closeTargetModal();
  renderAll();
}

function resetCsvState(): void {
  csvHeaders = [];
  csvRows = [];
  csvExcluded = new Set();
  acctMap = {};
  currentImportBrokerage = null;
  syncGlobalRefs();
}

function openImportModal(): void {
  $('importStep1').style.display = '';
  $('importStep2').style.display = 'none';
  $('csvPasteArea').value = '';
  ($('csvFileInput') as HTMLInputElement).value = '';
  resetCsvState();
  $('importModal').classList.add('open');
}

function closeImportModal(): void {
  $('importModal').classList.remove('open');
}

function importGoBack(): void {
  $('importStep1').style.display = '';
  $('importStep2').style.display = 'none';
}

function applyPreset(key: string): void {
  const preset = PRESETS[key];
  if (!preset) return;
  currentImportBrokerage = key === 'generic' ? null : preset.label;

  const fieldMap: Record<string, keyof typeof preset.map> = {
    mapTicker: 'ticker',
    mapName: 'name',
    mapShares: 'shares',
    mapPrice: 'price',
    mapCostBasis: 'costBasis',
    mapCostTotal: 'costTotal',
    mapValue: 'value',
    mapAccount: 'account',
  };

  for (const [selectId, presetKey] of Object.entries(fieldMap)) {
    const target = preset.map[presetKey];
    if (!target) {
      $(selectId).value = '';
      continue;
    }
    const idx = csvHeaders.findIndex((header) =>
      header.toLowerCase().replace(/[^a-z0-9]/g, '').includes(target.toLowerCase().replace(/[^a-z0-9]/g, ''))
    );
    $(selectId).value = idx >= 0 ? String(idx) : '';
  }

  updateCsvPreview();
}

function autoDetectPreset(): void {
  const joined = csvHeaders.join(' ').toLowerCase();
  if (joined.includes('cost basis total') || joined.includes('account name/number')) applyPreset('fidelity');
  else if (joined.includes('investment name') || joined.includes('share price')) applyPreset('vanguard');
  else if (joined.includes('last price $') || joined.includes('value $')) applyPreset('etrade');
  else applyPreset('generic');

  document.querySelectorAll('.preset-btn').forEach((button) => {
    button.classList.toggle('active', button.getAttribute('data-preset') === (
      joined.includes('cost basis total') || joined.includes('account name/number') ? 'fidelity'
        : joined.includes('investment name') || joined.includes('share price') ? 'vanguard'
        : joined.includes('last price $') || joined.includes('value $') ? 'etrade'
        : 'generic'
    ));
  });
}

function getCol(row: CsvRow, selectId: string): string {
  const idx = $(selectId).value;
  if (idx === '') return '';
  return (row[parseInt(idx, 10)] || '').trim();
}

function findCsvHeaderIndex(...targets: string[]): number {
  const normalizedTargets = targets.map((target) => target.toLowerCase().replace(/[^a-z0-9]/g, ''));
  return csvHeaders.findIndex((header) => {
    const normalizedHeader = header.toLowerCase().replace(/[^a-z0-9]/g, '');
    return normalizedTargets.some((target) => normalizedHeader === target || normalizedHeader.includes(target));
  });
}

function isAccountHintHeader(header: string): boolean {
  const normalized = header.toLowerCase().replace(/[^a-z0-9]/g, '');
  return normalized.includes('accountname')
    || normalized.includes('accounttype')
    || normalized.includes('accttype')
    || normalized === 'account'
    || normalized.includes('registration');
}

function normalizeImportedTicker(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/\*+$/g, '')
    .replace(/[^A-Z0-9.]/g, '');
}

function getImportedPrice(row: CsvRow, ticker = '', name = ''): number {
  const shares = parseNum(getCol(row, 'mapShares'));
  const price = parseNum(getCol(row, 'mapPrice'));
  const value = parseNum(getCol(row, 'mapValue'));
  if (price > 0) return price;
  if (shares > 0 && value > 0) return value / shares;
  if (guessCategory(ticker, name) === 'cash' && value > 0) return 1;

  return 0;
}

function getImportedShares(row: CsvRow, ticker = '', name = ''): number {
  const shares = parseNum(getCol(row, 'mapShares'));
  if (shares > 0) return shares;

  const price = getImportedPrice(row, ticker, name);
  const value = parseNum(getCol(row, 'mapValue'));
  if (price > 0 && value > 0) return value / price;

  return 0;
}

function getRowAccountHints(row: CsvRow, acctRaw = ''): string[] {
  const hints: string[] = [];
  const addHint = (value: string) => {
    const trimmed = value.trim();
    if (trimmed && !hints.includes(trimmed)) hints.push(trimmed);
  };

  addHint(acctRaw);

  for (let i = 0; i < csvHeaders.length; i++) {
    if (isAccountHintHeader(csvHeaders[i])) addHint(row[i] || '');
  }

  return hints;
}

function getAccountGuessSource(acctRaw: string): string {
  for (let i = 0; i < csvRows.length; i++) {
    if (csvExcluded.has(i)) continue;
    const rowAcct = getCol(csvRows[i], 'mapAccount').trim();
    if (rowAcct === acctRaw) {
      const hints = getRowAccountHints(csvRows[i], acctRaw);
      const bestHint = hints.find((hint) => guessAccountType(hint) !== 'taxable');
      return bestHint || hints[0] || acctRaw;
    }
  }
  return acctRaw;
}

function resolveAccountType(acctRaw: string, row?: CsvRow): AccountType {
  if (acctRaw && acctMap[acctRaw]) return acctMap[acctRaw];
  if (row) {
    const hints = getRowAccountHints(row, acctRaw);
    for (const hint of hints) {
      const guessed = guessAccountType(hint);
      if (guessed !== 'taxable') return guessed;
    }
  }
  return acctMap._default || 'taxable';
}

function parseCsvInput(): void {
  const raw = $('csvPasteArea').value.trim();
  if (!raw) return;

  const parsed = parseCsv(raw);
  if (parsed.length < 2) return;

  csvHeaders = parsed[0].map((header) => header.trim());
  csvRows = parsed.slice(1).filter((row) => row.some((cell) => cell.trim() !== ''));
  csvExcluded = new Set();

  csvRows.forEach((row, index) => {
    const first = row[0]?.trim().toLowerCase() || '';
    const joined = row.join(' ').toLowerCase();
    if (!first || first === 'total' || first === 'cash' || first.startsWith('account total')
      || first === '--' || first === 'pending activity'
      || /^account\s*(number|#|no|num)?\s/i.test(joined)) {
      csvExcluded.add(index);
    }
  });

  for (const id of ['mapTicker', 'mapName', 'mapShares', 'mapPrice', 'mapCostBasis', 'mapCostTotal', 'mapValue', 'mapAccount']) {
    $(id).innerHTML = '<option value="">(unmapped)</option>' + csvHeaders.map((header, index) => `<option value="${index}">${esc(header)}</option>`).join('');
  }

  for (const id of ['mapTicker', 'mapName', 'mapShares', 'mapPrice', 'mapCostBasis', 'mapCostTotal', 'mapValue', 'mapAccount']) {
    $(id).onchange = () => updateCsvPreview();
  }

  $('presetBtns').innerHTML = Object.entries(PRESETS).map(([key, preset]) =>
    `<button class="preset-btn" data-preset="${key}">${preset.label}</button>`
  ).join('');

  document.querySelectorAll('.preset-btn').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.preset-btn').forEach((b) => b.classList.remove('active'));
      button.classList.add('active');
      applyPreset(button.getAttribute('data-preset') || '');
    });
  });

  autoDetectPreset();

  $('importStep1').style.display = 'none';
  $('importStep2').style.display = '';
  updateCsvPreview();
}

function updateCsvPreview(): void {
  const acctColumnMapped = $('mapAccount').value !== '';
  const uniqueAccounts = new Set<string>();

  if (acctColumnMapped) {
    for (let i = 0; i < csvRows.length; i++) {
      if (csvExcluded.has(i)) continue;
      const acct = getCol(csvRows[i], 'mapAccount').trim();
      if (acct && !/^(account|acct|account\s*(number|#|no|num)?)$/i.test(acct)) {
        uniqueAccounts.add(acct);
      }
    }
  }

  if (uniqueAccounts.size > 0) {
    const mappingTitle = uniqueAccounts.size > 1 ? 'Map Account Numbers' : 'Map Account';
    const mappingHelp = uniqueAccounts.size > 1
      ? 'Assign each account number to an account type:'
      : 'Assign this account to an account type:';
    $('acctMappingArea').innerHTML = `
      <div style="margin-bottom:0.75rem;">
        <div style="font-size:0.8rem;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:0.5rem;">${mappingTitle}</div>
        <div style="font-size:0.8rem;color:var(--muted);margin-bottom:0.5rem;">${mappingHelp}</div>
        ${[...uniqueAccounts].map((acctValue) => {
          if (!(acctValue in acctMap)) acctMap[acctValue] = guessAccountType(getAccountGuessSource(acctValue));
          return `<div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.4rem;">
            <span style="font-size:0.85rem;min-width:140px;font-family:monospace;color:var(--text);">${esc(acctValue)}</span>
            <select class="acct-map-select" data-acct="${esc(acctValue)}" onchange="acctMap['${acctValue.replace(/'/g, "\\'")}'] = this.value; updateCsvPreview();" style="padding:0.3rem 0.5rem;background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:0.85rem;">
              <option value="taxable" ${acctMap[acctValue] === 'taxable' ? 'selected' : ''}>Taxable</option>
              <option value="hsa" ${acctMap[acctValue] === 'hsa' ? 'selected' : ''}>HSA</option>
              <option value="ira" ${acctMap[acctValue] === 'ira' ? 'selected' : ''}>Traditional IRA</option>
              <option value="roth" ${acctMap[acctValue] === 'roth' ? 'selected' : ''}>Roth IRA</option>
            </select>
          </div>`;
        }).join('')}
      </div>`;
  } else {
    const currentDefault = acctMap._default || 'taxable';
    $('acctMappingArea').innerHTML = `
      <div class="field">
        <label for="importAcctDefault">Default account type for all rows</label>
        <select id="importAcctDefault" onchange="acctMap._default = this.value;">
          <option value="roth" ${currentDefault === 'roth' ? 'selected' : ''}>Roth IRA</option>
          <option value="hsa" ${currentDefault === 'hsa' ? 'selected' : ''}>HSA</option>
          <option value="ira" ${currentDefault === 'ira' ? 'selected' : ''}>Traditional IRA</option>
          <option value="taxable" ${currentDefault === 'taxable' ? 'selected' : ''}>Taxable</option>
        </select>
      </div>`;
  }

  syncGlobalRefs();

  const preview = csvRows.slice(0, 10);
  let validCount = 0;

  $('csvPreviewTable').innerHTML = `
    <thead><tr>
      <th></th><th>Ticker</th><th>Name</th><th>Shares</th><th>Price</th><th>Cost/sh</th><th>Value</th><th>Account</th>
    </tr></thead>
    <tbody>${preview.map((row, index) => {
      const excluded = csvExcluded.has(index);
      const ticker = normalizeImportedTicker(getCol(row, 'mapTicker'));
      const name = getCol(row, 'mapName');
      const shares = getImportedShares(row, ticker, name);
      const price = getImportedPrice(row, ticker, name);
      const costPerShare = parseNum(getCol(row, 'mapCostBasis'));
      const costTotal = parseNum(getCol(row, 'mapCostTotal'));
      const value = parseNum(getCol(row, 'mapValue'));
      const acctRaw = getCol(row, 'mapAccount').trim();
      const category = guessCategory(ticker, name);

      const effectiveCost = costPerShare > 0
        ? costPerShare
        : shares > 0 && costTotal > 0
          ? costTotal / shares
          : category === 'cash' && price > 0
            ? price
            : 0;
      const effectivePrice = price > 0 ? price : (shares > 0 && value > 0 ? value / shares : 0);
      const resolvedAcct = resolveAccountType(acctRaw, row);

      if (ticker && shares > 0 && !excluded) validCount++;

      return `<tr class="${excluded ? 'row-excluded' : ''}">
        <td><input type="checkbox" ${excluded ? '' : 'checked'} onchange="toggleCsvRow(${index}, this.checked)"></td>
        <td><strong>${esc(ticker) || '—'}</strong></td>
        <td>${esc(name) || '—'}</td>
        <td>${shares || '—'}</td>
        <td>${effectivePrice ? `$${fmtD(effectivePrice, 2)}` : '—'}</td>
        <td>${effectiveCost ? `$${fmtD(effectiveCost, 2)}` : '—'}</td>
        <td>${shares && effectivePrice ? `$${fmt(shares * effectivePrice)}` : '—'}</td>
        <td>${ACCOUNT_LABELS[resolvedAcct]}${acctRaw ? ` <span style="color:var(--muted);font-size:0.75rem;">(${esc(acctRaw.slice(-4))})</span>` : ''}</td>
      </tr>`;
    }).join('')}</tbody>`;

  let totalValid = 0;
  for (let i = 0; i < csvRows.length; i++) {
    if (csvExcluded.has(i)) continue;
    const ticker = normalizeImportedTicker(getCol(csvRows[i], 'mapTicker'));
    const name = getCol(csvRows[i], 'mapName');
    const shares = getImportedShares(csvRows[i], ticker, name);
    if (ticker && shares > 0) totalValid++;
  }

  $('importSummary').innerHTML = `<strong>${totalValid}</strong> holdings will be imported from <strong>${csvRows.length}</strong> total rows.` +
    (csvExcluded.size > 0 ? ` ${csvExcluded.size} rows excluded.` : '') +
    (csvRows.length > 10 ? ' (showing first 10)' : '') +
    (holdings.length > 0 ? `<br><span style="font-size:0.8rem;color:var(--muted);">You have ${holdings.length} existing holdings. Duplicates are matched by ticker + account + brokerage + account number.</span>` : '');
}

function toggleCsvRow(index: number, checked: boolean): void {
  if (checked) csvExcluded.delete(index);
  else csvExcluded.add(index);
  updateCsvPreview();
}

function executeImport(): void {
  const imported: Holding[] = [];

  for (let i = 0; i < csvRows.length; i++) {
    if (csvExcluded.has(i)) continue;
    const row = csvRows[i];
    const ticker = normalizeImportedTicker(getCol(row, 'mapTicker'));
    const name = getCol(row, 'mapName');
    const shares = getImportedShares(row, ticker, name);
    const price = getImportedPrice(row, ticker, name);
    const costPerShare = parseNum(getCol(row, 'mapCostBasis'));
    const costTotal = parseNum(getCol(row, 'mapCostTotal'));
    const value = parseNum(getCol(row, 'mapValue'));
    const acctCol = getCol(row, 'mapAccount').trim();

    if (!ticker || shares <= 0) continue;

    const category = guessCategory(ticker, name);
    const effectivePrice = price > 0 ? price : (shares > 0 && value > 0 ? value / shares : 0);
    const effectiveCost = costPerShare > 0
      ? costPerShare
      : shares > 0 && costTotal > 0
        ? costTotal / shares
        : category === 'cash' && effectivePrice > 0
          ? effectivePrice
          : 0;

    imported.push({
      ticker,
      name: name || ticker,
      account: resolveAccountType(acctCol, row),
      brokerage: currentImportBrokerage || undefined,
      accountNumber: acctCol || '',
      category,
      shares,
      costBasis: Math.round(effectiveCost * 100) / 100,
      price: Math.round(effectivePrice * 100) / 100,
      dividendYield: lookupYield(ticker) ?? estimateYieldByCategory(category),
    });
  }

  if (imported.length === 0) return;

  if (($('importReplace') as HTMLInputElement).checked) {
    setHoldings(imported);
  } else {
    let added = 0;
    let merged = 0;
    for (const importedHolding of imported) {
      const key = getHoldingIdentity(importedHolding);
      const existing = holdings.find((holding) => getHoldingIdentity(holding) === key);
      if (existing) {
        existing.shares = importedHolding.shares;
        existing.price = importedHolding.price;
        existing.costBasis = importedHolding.costBasis;
        if (importedHolding.name && importedHolding.name !== importedHolding.ticker) existing.name = importedHolding.name;
        merged++;
      } else {
        holdings.push(importedHolding);
        added++;
      }
    }
    const parts = [];
    if (added > 0) parts.push(`${added} new`);
    if (merged > 0) parts.push(`${merged} updated`);
    showImportToast(parts.join(', '));
  }

  persist();
  closeImportModal();
  renderAll();
}

function showImportToast(message: string): void {
  const toast = document.createElement('div');
  toast.textContent = `Import: ${message}`;
  Object.assign(toast.style, {
    position: 'fixed',
    bottom: '2rem',
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'var(--accent-dim)',
    color: 'var(--accent)',
    border: '1px solid rgba(34,197,94,0.3)',
    padding: '0.75rem 1.5rem',
    borderRadius: '10px',
    fontSize: '0.9rem',
    fontWeight: '600',
    zIndex: '10000',
    transition: 'opacity 0.3s',
  });
  document.body.appendChild(toast);
  window.setTimeout(() => {
    toast.style.opacity = '0';
  }, 2500);
  window.setTimeout(() => {
    toast.remove();
  }, 3000);
}

function openCostBasisModal(): void {
  $('cbPasteArea').value = '';
  ($('cbFileInput') as HTMLInputElement).value = '';
  $('cbPreview').style.display = 'none';
  $('cbImportBtn').style.display = 'none';
  cbParsedRows = [];
  $('costBasisModal').classList.add('open');
}

function closeCostBasisModal(): void {
  $('costBasisModal').classList.remove('open');
}

function parseCostBasisInput(): void {
  let raw = $('cbPasteArea').value.trim();
  if (!raw) return;
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);

  const firstLine = raw.split(/\r?\n/)[0];
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  let rows = tabCount > commaCount ? raw.split(/\r?\n/).map((line) => line.split('\t')) : parseCsv(raw);
  if (rows.length < 2) return;

  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const joined = rows[i].join(' ').toLowerCase();
    if (joined.includes('symbol') || joined.includes('cusip')) {
      headerRowIdx = i;
      break;
    }
  }

  const headers = rows[headerRowIdx].map((header) => header.trim().toLowerCase().replace(/[^a-z0-9/ ]/g, ''));
  rows = rows.slice(headerRowIdx + 1);

  const symIdx = headers.findIndex((h) => h.includes('symbol') || h.includes('cusip'));
  const descIdx = headers.findIndex((h) => h.includes('description') || h.includes('name'));
  const qtyIdx = headers.findIndex((h) => h.includes('quantity') || h.includes('shares'));
  const costPerIdx = headers.findIndex((h) => h.includes('cost per share'));
  const costTotalIdx = headers.findIndex((h) => h.includes('total cost'));
  const stGainIdx = headers.findIndex((h) => h.includes('short term gain'));
  const ltGainIdx = headers.findIndex((h) => h.includes('long term gain'));
  const totalGainIdx = headers.findIndex((h) => h.includes('total gain'));

  if (symIdx < 0) {
    $('cbPreview').innerHTML = '<div style="color:var(--red);">Could not find Symbol column. Check CSV format.</div>';
    $('cbPreview').style.display = '';
    return;
  }

  const byTicker: Record<string, CostBasisAggregate> = {};
  for (const row of rows) {
    const sym = (row[symIdx] || '').trim().toUpperCase().replace(/[^A-Z0-9.]/g, '');
    if (!sym) continue;
    const qty = qtyIdx >= 0 ? parseNum(row[qtyIdx]) : 0;
    const costPer = costPerIdx >= 0 ? parseNum(row[costPerIdx]) : 0;
    const costTot = costTotalIdx >= 0 ? parseNum(row[costTotalIdx]) : 0;
    const stGain = stGainIdx >= 0 ? parseNum(row[stGainIdx]) : 0;
    const ltGain = ltGainIdx >= 0 ? parseNum(row[ltGainIdx]) : 0;
    const totalGain = totalGainIdx >= 0 ? parseNum(row[totalGainIdx]) : 0;
    const desc = descIdx >= 0 ? (row[descIdx] || '').trim() : '';

    if (!byTicker[sym]) {
      byTicker[sym] = { ticker: sym, name: desc, totalShares: 0, totalCost: 0, stGain: 0, ltGain: 0, totalGain: 0, lots: 0 };
    }
    byTicker[sym].totalShares += qty;
    byTicker[sym].totalCost += costTot > 0 ? costTot : qty * costPer;
    byTicker[sym].stGain += stGain;
    byTicker[sym].ltGain += ltGain;
    byTicker[sym].totalGain += totalGain;
    byTicker[sym].lots++;
  }

  cbParsedRows = Object.values(byTicker).filter((row) => row.totalShares > 0);
  if (cbParsedRows.length === 0) {
    $('cbPreview').innerHTML = '<div style="color:var(--red);">No valid holdings found in CSV.</div>';
    $('cbPreview').style.display = '';
    return;
  }

  let matched = 0;
  let unmatched = 0;
  const previewRows = cbParsedRows.map((row) => {
    const costPerShare = row.totalShares > 0 ? row.totalCost / row.totalShares : 0;
    const existing = holdings.find((h) => h.ticker === row.ticker && h.account === 'taxable');
    const hasMatch = !!existing;
    if (hasMatch) matched++;
    else unmatched++;
    return `<tr style="${hasMatch ? '' : 'opacity:0.4;'}">
      <td style="font-weight:600;">${esc(row.ticker)}</td>
      <td style="color:var(--muted);max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(row.name)}</td>
      <td style="text-align:right;">${fmtD(row.totalShares, 1)}</td>
      <td style="text-align:right;">$${fmtD(costPerShare, 2)}</td>
      <td style="text-align:right;">$${fmt(Math.round(row.totalCost))}</td>
      <td style="text-align:right;color:${row.totalGain >= 0 ? 'var(--accent)' : 'var(--red)'}">$${fmt(Math.round(row.totalGain))}</td>
      <td style="text-align:right;">${row.lots} lot${row.lots !== 1 ? 's' : ''}</td>
      <td>${hasMatch ? '<span style="color:var(--accent);">&#10003; matched</span>' : '<span style="color:var(--muted);">no match</span>'}</td>
    </tr>`;
  }).join('');

  $('cbPreview').innerHTML = `
    <div style="font-size:0.85rem;margin-bottom:0.5rem;">
      <strong>${matched}</strong> matched to existing taxable holdings, <strong>${unmatched}</strong> unmatched.
      ${unmatched > 0 ? '<span style="color:var(--muted);">Unmatched tickers will be skipped — import holdings first.</span>' : ''}
    </div>
    <div style="max-height:300px;overflow:auto;border:1px solid var(--border);border-radius:8px;">
      <table style="width:100%;border-collapse:collapse;font-size:0.8rem;">
        <thead><tr style="background:var(--bg);position:sticky;top:0;">
          <th style="padding:0.4rem 0.6rem;text-align:left;">Ticker</th>
          <th style="padding:0.4rem 0.6rem;text-align:left;">Name</th>
          <th style="padding:0.4rem 0.6rem;text-align:right;">Shares</th>
          <th style="padding:0.4rem 0.6rem;text-align:right;">Cost/sh</th>
          <th style="padding:0.4rem 0.6rem;text-align:right;">Total Cost</th>
          <th style="padding:0.4rem 0.6rem;text-align:right;">Gain/Loss</th>
          <th style="padding:0.4rem 0.6rem;text-align:right;">Lots</th>
          <th style="padding:0.4rem 0.6rem;">Status</th>
        </tr></thead>
        <tbody>${previewRows}</tbody>
      </table>
    </div>`;
  $('cbPreview').style.display = '';
  $('cbImportBtn').style.display = matched > 0 ? '' : 'none';
}

function executeCostBasisImport(): void {
  let updated = 0;
  for (const row of cbParsedRows) {
    const costPerShare = row.totalShares > 0 ? Math.round((row.totalCost / row.totalShares) * 100) / 100 : 0;
    const matches = holdings.filter((h) => h.ticker === row.ticker && h.account === 'taxable');
    for (const holding of matches) {
      holding.costBasis = costPerShare;
      updated++;
    }
  }
  if (updated > 0) {
    persist();
    renderAll();
  }
  closeCostBasisModal();
  showImportToast(`Cost basis updated for ${updated} holding${updated !== 1 ? 's' : ''}`);
}

function switchPage(page: AppPage): void {
  document.querySelectorAll('.page-tab').forEach((tab) => {
    tab.classList.toggle('active', (tab as HTMLButtonElement).dataset.page === page);
  });
  document.querySelectorAll('.page-section').forEach((section) => section.classList.remove('active'));
  const pageId = page === 'planner'
    ? 'pagePlanner'
    : page === 'portfolio'
      ? 'pagePortfolio'
      : page === 'brokerages'
        ? 'pageBrokerages'
        : page === 'symbols'
          ? 'pageSymbols'
          : page === 'drawdown'
            ? 'pageDrawdown'
          : page === 'conversion'
            ? 'pageConversion'
            : 'pageHealthcare';
  $(pageId).classList.add('active');
  if (page === 'planner') renderPlanner(true, false);
  if (page === 'brokerages') renderBrokerages();
  if (page === 'symbols') renderSymbols();
  if (page === 'drawdown') renderDrawdownPlan();
  if (page === 'conversion') renderConversionOptimizer();
  if (page === 'healthcare') renderHealthcare();
}

function exportBackup(event: Event): void {
  event.preventDefault();
  const data = {
    version: 5,
    date: new Date().toISOString(),
    holdings,
    targets,
    yieldCache,
    age: readInt('currentAge', 50),
    retirementAge: readRetirementAge(),
    plannerInputs: readPlannerInputSnapshot(),
    drawdownInputs: readDrawdownInputSnapshot(),
    planningScenarios,
    activeDrawdownScenarioId,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `fire-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function importBackup(event: Event): void {
  event.preventDefault();
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      try {
        const data = JSON.parse(String(loadEvent.target?.result || ''));
        if (!Array.isArray(data.holdings)) {
          alert('Invalid backup file — no holdings found.');
          return;
        }
        if (!confirm(`Restore backup from ${data.date ? data.date.slice(0, 10) : 'unknown date'}? This will replace all current data (${holdings.length} holdings).`)) {
          return;
        }
        setHoldings(data.holdings);
        if (data.targets) setTargets(data.targets);
        if (data.yieldCache) setYieldCache(data.yieldCache as YieldCache);
        if (data.plannerInputs) {
          for (const id of plannerInputIds) {
            const value = data.plannerInputs[id];
            if (value != null) $(id).value = String(value);
          }
          if (typeof data.plannerInputs.taxRateAuto === 'boolean') $('taxRateAuto').checked = data.plannerInputs.taxRateAuto;
          if (typeof data.plannerInputs.retireExpensesCustom === 'boolean') plannerRetireExpensesCustom = data.plannerInputs.retireExpensesCustom;
          localStorage.setItem(PLANNER_INPUTS_STORAGE_KEY, JSON.stringify(data.plannerInputs));
        } else if (data.age) {
          $('currentAge').value = String(data.age);
          persistPlannerInputs();
        }
        if (data.retirementAge != null) {
          $('retirementAge').value = String(data.retirementAge);
          localStorage.setItem('fire_retirement_age', String(data.retirementAge));
        }
        if (data.drawdownInputs) {
          localStorage.setItem(DRAWDOWN_INPUTS_STORAGE_KEY, JSON.stringify(data.drawdownInputs));
        }
        planningScenarios = Array.isArray(data.planningScenarios)
          ? data.planningScenarios
            .map(normalizePlanningScenario)
            .filter((scenario): scenario is PlanningScenario => scenario !== null)
          : [];
        persistPlanningScenarios();
        if (typeof data.activeDrawdownScenarioId === 'string'
          && planningScenarios.some((scenario) => scenario.id === data.activeDrawdownScenarioId)) {
          setActiveDrawdownScenario(data.activeDrawdownScenarioId);
        } else {
          setActiveDrawdownScenario(null);
        }
        persist();
        persistYieldCache();
        location.reload();
      } catch (error) {
        alert(`Failed to parse backup file: ${(error as Error).message}`);
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

function setActiveAccountTab(account: string): void {
  document.querySelectorAll('.account-tab').forEach((tab) => {
    tab.classList.toggle('active', (tab as HTMLButtonElement).dataset.account === account);
  });
}

function loadDemoPortfolio(event: Event): void {
  event.preventDefault();
  if (!confirm('Delete all current holdings/imports and replace them with the built-in demo portfolio and default settings?')) return;
  localStorage.removeItem('fire_holdings');
  localStorage.removeItem('fire_targets');
  localStorage.removeItem('fire_yield_cache');
  localStorage.removeItem('fire_user_age');
  localStorage.removeItem('fire_retirement_age');
  localStorage.removeItem('fire_base_income');
  localStorage.removeItem(DRAWDOWN_INPUTS_STORAGE_KEY);
  localStorage.removeItem(PLANNING_SCENARIOS_STORAGE_KEY);
  localStorage.removeItem(ACTIVE_DRAWDOWN_SCENARIO_STORAGE_KEY);
  setHoldings(createDemoHoldings());
  setTargets({ ...DEFAULT_TARGETS });
  setYieldCache(createDemoYieldCache());
  setActiveAccount('all');
  holdingsSort.key = null;
  holdingsSort.asc = true;
  setActiveAccountTab('all');
  activeBrokerageFilter = 'all';
  editingSymbolTicker = null;
  lastRefreshReport = null;
  persistSymbolRefreshReport();
  planningScenarios = [];
  activeDrawdownScenarioId = null;
  resetCsvState();
  cbParsedRows = [];
  const plannerDefaults: Record<(typeof plannerInputIds)[number], string> = {
    currentAge: '50',
    filingStatus: 'single',
    householdSize: '1',
    spouseAge: '50',
    spouseAnnualIncome: '0',
    spouseRetirementAge: '67',
    annualIncome: '100000',
    annualExpenses: '40000',
    currentSavings: '250000',
    returnRate: '7',
    inflationRate: '3',
    withdrawalRate: '4',
    taxRate: '25',
    retireExpenses: '40000',
    longevityAge: '95',
    socialSecurityClaimAge: '67',
    socialSecurityBenefit: '0',
    spouseSocialSecurityClaimAge: '67',
    spouseSocialSecurityBenefit: '0',
  };
  for (const id of plannerInputIds) $(id).value = plannerDefaults[id];
  $('taxRateAuto').checked = true;
  plannerRetireExpensesCustom = false;
  syncRetireExpensesFromCurrent();
  syncHouseholdDefaults(true);
  $('retirementAge').value = '55';
  applyDrawdownInputSnapshot(emptyDrawdownInputSnapshot());
  persist();
  persistYieldCache();
  persistPlannerInputs();
  persistDrawdownInputs();
  localStorage.setItem('fire_retirement_age', '55');
  switchPage('planner');
  location.reload();
}

function attachStaticListeners(): void {
  document.querySelectorAll('.account-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.account-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      setActiveAccount((tab as HTMLButtonElement).dataset.account || 'all');
      renderPortfolio();
    });
  });

  ['tUS', 'tIntl', 'tBond', 'tMuni', 'tREIT', 'tCash', 'tCrypto', 'tOther'].forEach((id) => {
    $(id).addEventListener('input', updateTargetSum);
  });

  ['coLifeExp', 'coSpending', 'coSSIncome', 'coStrategy', 'coTaxableReturn', 'coIraReturn', 'coRothReturn'].forEach((id) => {
    $(id).addEventListener($(id).tagName === 'SELECT' ? 'change' : 'input', renderConversionOptimizer);
  });

  drawdownInputIds.forEach((id) => {
    $(id).addEventListener('input', () => {
      persistDrawdownInputs();
      clearActiveDrawdownScenario();
      renderPlanner(false, false);
      renderDrawdownPlan();
    });
  });

  document.querySelectorAll('.modal-overlay').forEach((overlay) => {
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) overlay.classList.remove('open');
    });
  });

  const dropZone = $('dropZone');
  const csvFileInput = $('csvFileInput') as HTMLInputElement;
  dropZone.addEventListener('click', () => csvFileInput.click());
  dropZone.addEventListener('dragover', (event) => {
    event.preventDefault();
    dropZone.classList.add('drag-over');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', (event: DragEvent) => {
    event.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = event.dataTransfer?.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      $('csvPasteArea').value = String(loadEvent.target?.result || '');
      parseCsvInput();
    };
    reader.readAsText(file);
  });
  csvFileInput.addEventListener('change', (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      $('csvPasteArea').value = String(loadEvent.target?.result || '');
      parseCsvInput();
    };
    reader.readAsText(file);
  });

  const cbDropZone = $('cbDropZone');
  const cbFileInput = $('cbFileInput') as HTMLInputElement;
  cbDropZone.addEventListener('click', () => cbFileInput.click());
  cbDropZone.addEventListener('dragover', (event) => {
    event.preventDefault();
    cbDropZone.style.borderColor = 'var(--accent)';
  });
  cbDropZone.addEventListener('dragleave', () => {
    cbDropZone.style.borderColor = 'var(--border)';
  });
  cbDropZone.addEventListener('drop', (event: DragEvent) => {
    event.preventDefault();
    cbDropZone.style.borderColor = 'var(--border)';
    const file = event.dataTransfer?.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      $('cbPasteArea').value = String(loadEvent.target?.result || '');
      parseCostBasisInput();
    };
    reader.readAsText(file);
  });
  cbFileInput.addEventListener('change', (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      $('cbPasteArea').value = String(loadEvent.target?.result || '');
      parseCostBasisInput();
    };
    reader.readAsText(file);
  });

  $('hTicker').addEventListener('input', () => {
    const ticker = $('hTicker').value.toUpperCase().trim();
    if (!ticker) {
      $('hYieldHint').textContent = '';
      return;
    }
    const known = lookupYield(ticker);
    if (known !== null) {
      $('hYield').placeholder = String(known);
      $('hYieldHint').textContent = `${ticker}: ~${known}% yield`;
      $('hYieldHint').style.color = 'var(--accent)';
    }
    if (tickerFetchTimer != null) window.clearTimeout(tickerFetchTimer);
    if (ticker.length >= 1 && ticker.length <= 5) {
      tickerFetchTimer = window.setTimeout(async () => {
        $('hYieldHint').textContent = `Looking up ${ticker}...`;
        $('hYieldHint').style.color = 'var(--muted)';
        try {
          const data = await fetchSingleYield(ticker);
          if ($('hTicker').value.toUpperCase().trim() !== ticker) return;
          if (data) {
            $('hYield').placeholder = String(data.yield);
            $('hYieldHint').textContent = `${ticker}: ${data.yield}% yield${data.price ? `, $${data.price.toFixed(2)}` : ''}`;
            $('hYieldHint').style.color = 'var(--accent)';
            if (!$('hPrice').value && data.price) $('hPrice').value = data.price.toFixed(2);
            if (!$('hName').value && data.name) $('hName').value = data.name;
          } else if (known === null) {
            $('hYieldHint').textContent = `${ticker}: not found`;
            $('hYieldHint').style.color = 'var(--red)';
          }
        } catch {
          // Keep static fallback data if the live lookup fails.
        }
      }, 500);
    }
  });

  $('retirementAge').addEventListener('input', () => {
    localStorage.setItem('fire_retirement_age', $('retirementAge').value);
    clearActiveDrawdownScenario();
    setRetirementAgeAutoUpdated(false);
    renderPlanner(false, false);
    renderRetirementPhase();
  });

  $('taxRateAuto').addEventListener('change', () => {
    clearActiveDrawdownScenario();
    updatePlannerTaxControls();
    persistPlannerInputs();
    renderAll(true);
  });

  plannerInputIds.forEach((id) => {
    $(id).addEventListener($(id).tagName === 'SELECT' ? 'change' : 'input', () => {
      if (id === 'annualExpenses') syncRetireExpensesFromCurrent();
      if (id === 'retireExpenses') plannerRetireExpensesCustom = $('retireExpenses').value !== $('annualExpenses').value;
      if (id === 'filingStatus' && $('filingStatus').value === 'married' && readInt('householdSize', 1) < 2) $('householdSize').value = '2';
      clearActiveDrawdownScenario();
      updatePlannerHouseholdVisibility();
      syncHouseholdDefaults();
      updatePlannerTaxControls();
      persistPlannerInputs();
      if (id === 'currentAge') localStorage.setItem('fire_user_age', $(id).value);
      renderAll(true);
    });
  });
}

setHoldingActions(editHolding, deleteHolding);
setOnSortChange(renderHoldings);
attachGlobals();
attachStaticListeners();

hydratePlannerInputs();
hydrateDrawdownInputs();
const savedRetirementAge = localStorage.getItem('fire_retirement_age');
if (savedRetirementAge) {
  $('retirementAge').value = savedRetirementAge;
  setRetirementAgeAutoUpdated(false);
}
updatePlannerHouseholdVisibility();
syncRetireExpensesFromCurrent();
syncHouseholdDefaults(true);
updatePlannerTaxControls();
if (!savedRetirementAge) syncRetirementAgeDefault();

renderAll(!savedRetirementAge);
