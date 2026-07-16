# QUESTIONS — bizapps-accounting (plans-level question stock)

> Structured per the questions convention (`~/MJDev/shared-plans/questions-convention.md`):
> stable append-only body + two derived indexes; entry template modeled on Q22/Q24. **A question
> lives in exactly ONE file** — this repo's active questions are currently homed in the instance
> stock (`~/MJDev/instances/accounting-engine-dev/QUESTIONS.md`), created there during this
> development wave; the indexes below link across (convention rule 8). NEW repo-scoped questions
> raised outside an instance context get appended HERE as `AQ1`, `AQ2`, … in the template format.

## Index — by priority

| Ask order | Q | Ask | Status |
|---|---|---|---|
| 1 | [Q19](../../../../../../QUESTIONS.md#q19)* | Jeremy — golden path + exceptions (batch defaults, reversal continuity, backdating rules, dimension list) | OPEN ★HIGH |
| 2 | [Q22](../../../../../../QUESTIONS.md#q22)* | Robert — company-visibility mechanism (roles/RLS, A2) | OPEN |
| 3 | [Q24](../../../../../../QUESTIONS.md#q24)* | Robert — securable company-access grants + governance | OPEN |
| 4 | [Q6](../../../../../../QUESTIONS.md#q6)* | Robert — batch-approval workflow shape (+ manual-JE gate confirm) | OPEN |
| 5 | [Q7](../../../../../../QUESTIONS.md#q7)* | Robert — batches/approvals visibility (confirm at A2) | OPEN |
| 6 | [Q3](../../../../../../QUESTIONS.md#q3)* | Robert — JE-draft account contract (bless-as-built) | OPEN |
| 7 | [Q9](../../../../../../QUESTIONS.md#q9)* | Amith — GLAccountLink role FK (bless-as-built) | OPEN |

\* homed in the instance stock: `~/MJDev/instances/accounting-engine-dev/QUESTIONS.md`
(relative links resolve from this worktree; distribution copies:
`~/MJDev/reports/team-questions-2026-07-16/`).

## Index — by feature

| Feature | Open questions gating/shaping it |
|---|---|
| B.1 GL account mapping | Q9 |
| C.5 reversals / C.8 manual-JE gate | Q19(3), Q6(3) |
| D.3 batch approvals | Q6, Q7 |
| H reporting / cutover | Q19 ★ |
| K.1/K.2 roles + RLS (A2) | Q22, Q24, Q7 |
| L.2 JE draft contract | Q3 |
| (cross-cutting) | — |

## Questions (append-only body — repo-scoped entries)

_None yet. Template (Q22/Q24 model):_

```markdown
<a id="aq1"></a>
### AQ1 · <title> — ask <person> — added <date>
- **Status:** OPEN
- **Who to ask:** …
- **Features:** <FEATURE-LIST IDs>
- **Background (self-contained):** …
- **What motivates this now:** _(optional)_
- **Fixed constraints (not up for debate):** _(optional)_
- **The question for <person>:** (1) … (2) …
- **Context to share:** …
- **Additional context (for a verifying agent):** …
- **Answer:** _(pending)_
```
