# DEFERRALS — bizapps-accounting

Time/dependency deferrals of master-plan scope. Per the planning system (§5.2, 2026-07-14): a deferral is
a plan-time sequencing decision, NOT a master-plan contradiction. Entry: item · source · rationale ·
revisit trigger.

| Deferred item | Source | Rationale | Revisit trigger |
|---|---|---|---|
| `AccountBalance` / `AccountBalanceByDimension` materialization (§4.10, BA-D22) | MOD-2 (Amith: "might kill for v1") | §10 views compute balances on demand | read-model performance demands it |
| Tax CALCULATION provider + adapters — Avalara/TaxJar/Local (§9) | master Block-7 sequencing + open Robert tax-shape decision | tax DATA tables are built; the quick path (tax-as-order-line) may serve v0 | Robert's tax decision + a calculating consumer |
| Unrealized-FX revaluation + reporting-currency translation (§6.4/§6.5) | MOD-6 (all FX upstream) | FX itself is deferred (orders MOD-4); accounting keeps only refs + vw_FxExposure | multi-currency activates |
| Report Gallery app (§10.3) | master's own out-of-scope | referenced for completeness only | ecosystem-level decision |
| Intercompany receiving-contract tests (feature B4) | accounting MOD-5 (Payments owns legs + wiring) | nothing to receive until Payments/O2 exists | orders O2 lands |
