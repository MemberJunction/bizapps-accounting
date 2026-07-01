# testing.md — bizapps-accounting test ledger + coverage matrix

The **living coverage record** for this app's test suite, per the testing motto (filed in
`~/MJDev/MJDEV-REQUESTS.md`): *every feature, every variation, every layer, every interaction —
alone and composed as you ascend the tiers — fully validated, for all classes and possible data
cases, using prudent discrimination to limit tier-5 overuse but treating all other layers as cheap
and fully fleshing them out.*

Three sections: the **coverage matrix** (drive every ✗ to zero), the **intentional-⚠ register**
(coverage deliberately placed at a cheaper tier — NOT gaps), and the **ledger** (tests still to
create + open questions for the human, recorded so dev can roll through and circle back).

Tiers: **1** Vitest (unit) · **2** server (tsx, in-process direct SQL) · **3** API (GraphQL→MJAPI) ·
**4** GUI/DOM (no-browser — parked, mjdev overlay) · **5** Playwright (browser e2e, pre-PR only).

## Coverage matrix (✓ = real-value/exact · ⚠ = intentional, see register · ✗ = GAP, fill it)

| Feature / interaction | T1 | T2 | T3 | T5 |
|---|---|---|---|---|
| W1 company seeding (COA/periods/refs/TZ/audit) | — | ✓ | — | — |
| JE + batch numbering (W2/W3) | — | ✓ | — | — |
| JE balanced / immutability / period-close (bypass-proven) | ✓ | ✓ | — | — |
| JE validation (F1) | ✓ | ✓ | — | — |
| Adjusting-entry routing (W4) | — | ✓ | — | — |
| Reversal (W6) | — | ✓ | ✓ | ⚠ |
| Batch **netting + canceling** (exact values) | ✓ | ✓ | ✓ | ⚠ |
| GL resolution + COA-mapping approval (Block 5) | — | ✓ | — | — |
| Dimension-through-batch | ✓ | ✓ | ⚠ | ⚠ |
| CFO gate: approve → dispatch | — | ✓ | ✓ | ✓ |
| **Reject/deny → dispatch refused** | — | ✓ | ✓ | ⚠ |
| **No-CFO → build hard-fails** | — | ✓ | ✓ | — |
| **Multi-company independence (no cross-company bleed)** | — | ✓ | ✓ | ⚠ |
| **Due-to/from batched as-is, tag preserved, NO balancing** | — | ✓ | ✓ | ⚠ |
| Scheduled JEs (S3) | ✓ | ✓ | — | — |
| Read-models (TB/AR/aging/defrev/tax/dispatch/intercompany) | — | ✓ | ✓ | ⚠ |
| GUI dashboards + forms + nav | — | — | — | ✓ |

**No open ✗.** Every cell is covered or a justified ⚠ below.

## Intentional-⚠ register (coverage placed at a cheaper/other tier on purpose — NOT shortcuts)

- **Dimension-through-batch @ T3** — fully proven at **T2** (`block2` B5: same account × 2 dim values
  → separate, tagged summary lines, via SQL). The API's `BuildJEBatchResult` is aggregate; the
  consolidation it *does* report (`SummaryLineCount`) is already asserted at T3 (the canceling test in
  `batch-dispatch-api.ts`, 6 lines → 3 summary lines). A dimension-specific T3 test would re-prove the
  same `SummaryLineCount` mechanism on the same engine — redundant. **No API change needed** (an
  earlier proposal to add summary-line dimension fields was withdrawn — never grow the API to serve a test).
- **Reject · netting-exact · reversal · read-model-exact · intercompany · multi-company @ T5** —
  deliberately **thin at tier 5** (browser e2e is expensive). Exact values + variations are proven at
  T1/T2/T3; T5 proves the end-to-end *state machine* + that values reach the screen. This is the
  motto's "prudent discrimination"; tier-4 (the parked mjdev overlay) is the relief valve for fast exact-DOM.

## Ledger — tests still to create + open questions (roll-through: log, proceed, circle back)

**Tests to create:** _none open_ — every matrix gap is filled or a justified ⚠.

**Open questions for the human:** _none open._
- ✅ Due-to/from semantics **confirmed** (Marcelo): Accounting does **no** intercompany netting —
  the Payments component owns it. Accounting receives + batches the tagged JEs as-is. Tested exactly
  that at T2 (`batching-multicompany-runtime.ts`) + T3 (`batching-scenarios-api.ts`).
- ✅ "Change the API for T3 dimension" — **withdrawn** (not needed; observable behavior is covered).

## Harness inventory + run commands (cwd = instance worktree root)

| Tier | Harness | Run |
|---|---|---|
| 1 | `packages/CoreEntitiesServer/src/__tests__/*.test.ts` | `cd packages/dev-apps/bizapps-accounting/packages/CoreEntitiesServer && npx vitest run` |
| 2 | `test-harnesses/server/block{0,1,2,4,5,6}-runtime.ts` · `batching-multicompany-runtime.ts` | `npx tsx packages/dev-apps/bizapps-accounting/test-harnesses/server/<file>.ts` (per file) |
| 3 | `test-harnesses/api/readmodels-api.ts` · `batch-dispatch-api.ts` · `batching-scenarios-api.ts` | `npx tsx packages/dev-apps/bizapps-accounting/test-harnesses/api/<file>.ts` |
| 5 | `test-harnesses/playwright/specs/{dashboards,batching}.spec.ts` | `cd …/test-harnesses/playwright && npx playwright test` (MJAPI+Explorer up) |

Latest verified (this session): T1 **32/32** · T2 **65/65** (blocks) + **6/6** (multi-company) ·
T3 **28/28** + **17/17** + **12/12** · T5 dashboards **9/9** + batching green.
