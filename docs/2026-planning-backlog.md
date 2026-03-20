# FIRE Planner 2026 Backlog

Planning assumptions for this backlog:

- Use **2026** as the baseline planning year.
- Do **not** add a user-facing tax-year selector.
- Model future years with reasonable inflation-style adjustments where exact law is unknown.
- Favor educational planning accuracy over tax-form exactness.

## Prioritized Tickets

### FP-101: Centralize 2026 planning assumptions and forward-scaling rules

**Priority:** P0

**Why**

Tax, ACA, Medicare, and retirement thresholds are currently spread across constants and are partly tied to specific calendar-year labels. The app needs one planning baseline and one clear rule for how future years evolve.

**Scope**

- Add a single planning assumptions layer for 2026 baseline values.
- Define forward-scaling rules for brackets, deductions, ACA/FPL thresholds, IRMAA thresholds, and RMD assumptions.
- Replace hardcoded year-specific labels in the UI where they imply exact filing-year precision.

**Acceptance criteria**

- Core modules read thresholds from one shared planning assumptions source.
- The app can project future thresholds from 2026 without a tax-year selector.
- User-facing copy describes values as planning assumptions, not filing-year guarantees.

**Likely files**

- `src/constants/tax.ts`
- `src/constants/aca.ts`
- `src/constants/medicare.ts`
- `src/calc/tax.ts`
- `src/calc/aca.ts`
- `src/calc/medicare.ts`

### FP-102: Add household profile inputs

**Priority:** P0

**Why**

Single-filer assumptions materially distort real retirement, ACA, Medicare, and tax planning for couples and families.

**Scope**

- Add filing status.
- Add spouse age, spouse earned income, spouse retirement age, and spouse Social Security inputs.
- Add household size for ACA planning.
- Persist the new fields in local storage.

**Acceptance criteria**

- Planner, healthcare, and conversion views can run for single and married households.
- Household size changes ACA/FPL outputs.
- Spouse Social Security and spouse age flow into retirement and drawdown outputs.

**Likely files**

- `src/types.ts`
- `src/main.ts`
- `src/state/store.ts`
- `src/calc/fire.ts`
- `src/calc/aca.ts`
- `src/calc/medicare.ts`

### FP-103: Upgrade the tax engine for taxable-account realism

**Priority:** P0

**Why**

The current tool is directionally useful, but the next level of planning value comes from modeling what taxable investors actually face.

**Scope**

- Separate ordinary income, qualified dividends, and long-term capital gains.
- Add foreign tax credit estimates for taxable international funds.
- Add NIIT estimation where applicable.
- Distinguish sheltered accounts from taxable accounts more explicitly in projections.

**Acceptance criteria**

- Tax calculations expose ordinary-income tax, capital-gain tax, NIIT, and FTC components.
- International taxable holdings can reduce estimated federal tax via FTC, subject to a modeled limit.
- Planner outputs explain when qualified dividends and capital gains are being assumed.

**Likely files**

- `src/calc/tax.ts`
- `src/calc/fire.ts`
- `src/state/income.ts`
- `src/render/investment-income.ts`
- `src/render/planner.ts`

### FP-104: Track embedded gains and cost-basis sensitivity in taxable accounts

**Priority:** P1

**Why**

Withdrawal planning and tax-efficiency guidance are weaker when the tool knows value but not unrealized gains.

**Scope**

- Use existing holding cost basis data to estimate unrealized gains by taxable holding.
- Surface gain percentage and tax sensitivity in the portfolio UI.
- Feed embedded gains into drawdown and recommendation logic.

**Acceptance criteria**

- Taxable holdings show unrealized gain or loss estimates.
- Drawdown and recommendation views can distinguish high-basis from low-basis taxable assets.
- Portfolio suggestions avoid treating all taxable sales as equivalent.

**Likely files**

- `src/types.ts`
- `src/render/holdings.ts`
- `src/render/suggestions.ts`
- `src/calc/tax-efficiency.ts`
- `src/main.ts`

### FP-105: Replace static withdrawal order with a yearly tax-aware optimizer

**Priority:** P0

**Why**

A fixed withdrawal sequence leaves too much value on the table, especially for early retirees balancing ACA, conversions, and future RMDs.

**Scope**

- Optimize annual withdrawals across taxable, IRA, Roth, and HSA.
- Allow bracket filling up to a target marginal rate.
- Coordinate taxable sales, ordinary income, Roth conversions, and Social Security start dates.

**Acceptance criteria**

- Drawdown results show yearly source mix instead of only a static order.
- The optimizer can compare at least two strategies and explain why one wins.
- Year-by-year outputs include taxable income, tax paid, and account source mix.

**Likely files**

- `src/calc/drawdown.ts`
- `src/main.ts`
- `src/render/planner.ts`

### FP-106: Rebuild the Roth conversion calculator around bracket management

**Priority:** P0

**Why**

Roth conversions are most valuable when coordinated with taxable income, ACA subsidies, IRMAA, and future RMDs rather than treated as a narrow scenario tool.

**Scope**

- Let users set a marginal-rate ceiling rather than only strategy presets.
- Model the interaction among conversions, ACA MAGI, Social Security taxation, and future RMD pressure.
- Compare no-conversion, moderate conversion, and aggressive conversion paths using the same tax engine.

**Acceptance criteria**

- Conversion results show why the suggested amount is optimal under the tool's assumptions.
- Scenario tables show tax paid now versus tax avoided later.
- ACA and future Medicare effects are visible in the output.

**Likely files**

- `src/main.ts`
- `src/calc/drawdown.ts`
- `src/calc/tax.ts`
- `src/calc/aca.ts`
- `src/calc/medicare.ts`

### FP-107: Add Social Security claiming optimization

**Priority:** P1

**Why**

Claim timing is one of the highest-dollar retirement decisions and should not be reduced to a single manual input.

**Scope**

- Add claiming-age sweeps.
- Model spouse and survivor effects for married households.
- Show break-even framing and lifetime after-tax income impact.

**Acceptance criteria**

- The planner can compare multiple claim ages side by side.
- Married-household mode reflects survivor implications.
- Outputs clearly state the assumptions behind the recommendation.

**Likely files**

- `src/calc/fire.ts`
- `src/calc/drawdown.ts`
- `src/main.ts`
- `src/render/planner.ts`

### FP-108: Improve healthcare modeling with location-aware inputs

**Priority:** P1

**Why**

ACA and pre-Medicare healthcare costs vary too much by geography and benchmark pricing for a single generic table to be enough.

**Scope**

- Add state and county or ZIP proxy inputs.
- Allow manual benchmark silver premium override.
- Distinguish federal planning assumptions from user-entered local premium data.

**Acceptance criteria**

- Users can override benchmark premiums without changing core formulas.
- Healthcare outputs clearly show what came from assumptions versus user input.
- ACA sensitivity tables remain usable with custom premium inputs.

**Likely files**

- `src/main.ts`
- `src/calc/aca.ts`
- `src/render/planner.ts`

### FP-109: Add stress testing and guardrail spending analysis

**Priority:** P1

**Why**

A single deterministic return path is useful, but it hides sequence risk and spending flexibility.

**Scope**

- Add simple historical stress scenarios or Monte Carlo-lite analysis.
- Add guardrail spending rules for portfolio drawdowns.
- Show probability-style framing without pretending to predict exact outcomes.

**Acceptance criteria**

- Users can compare baseline, weak-market, and strong-market paths.
- Drawdown results can model spending reductions after poor returns.
- The UI explains that scenario analysis is heuristic, not a forecast.

**Likely files**

- `src/calc/drawdown.ts`
- `src/main.ts`
- `src/render/planner.ts`

### FP-110: Make recommendations auditable

**Priority:** P1

**Why**

Planning tools earn trust when users can see the assumptions behind the advice.

**Scope**

- Add explanation panels for portfolio, tax-efficiency, healthcare, and conversion recommendations.
- Show which thresholds, tax rates, and income assumptions drove each recommendation.
- Highlight when an answer is highly sensitive to uncertain inputs.

**Acceptance criteria**

- Every major recommendation has a visible "why this" explanation.
- The explanation references the main assumptions used.
- Sensitive outputs call out uncertainty instead of presenting false precision.

**Likely files**

- `src/render/suggestions.ts`
- `src/render/tax-efficiency.ts`
- `src/render/investment-income.ts`
- `src/main.ts`

### FP-111: Expand tests around planning assumptions and tax interactions

**Priority:** P0

**Why**

The planned work increases coupling among taxes, healthcare, drawdown, and account types. That needs stronger test coverage before behavior changes start shipping.

**Scope**

- Add tests for household profiles.
- Add tests for qualified dividends, LTCG, FTC, and NIIT interactions.
- Add tests for conversion and drawdown scenarios that cross ACA and Medicare thresholds.

**Acceptance criteria**

- New planning rules ship with unit tests for edge cases and representative scenarios.
- Regressions in threshold scaling and tax coordination are caught by CI.
- At least one end-to-end scenario test covers the main retirement flow.

**Likely files**

- `tests/calc/tax.test.ts`
- `tests/calc/fire.test.ts`
- `tests/calc/drawdown.test.ts`
- `tests/calc/aca.test.ts`

## Suggested Delivery Order

1. `FP-101` assumptions layer
2. `FP-102` household profile
3. `FP-103` tax engine realism
4. `FP-111` test expansion in parallel with the above
5. `FP-105` withdrawal optimizer
6. `FP-106` Roth conversion rebuild
7. `FP-104`, `FP-107`, `FP-108`, `FP-109`, `FP-110`
