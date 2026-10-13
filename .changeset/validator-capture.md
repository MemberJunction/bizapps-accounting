---
'@mj-biz-apps/accounting-entities': patch
---

A migration now stores the generated validator code for eight CHECK constraints on Journal Entry Batches, Finance Exception Types and Finance Exceptions. Before it, a database built from migrations had no stored code for them, so every CodeGen run asked the AI again and wrote new method names and bodies. The rows carry the validators already committed, so generated code is unchanged and reproducible from migrations.
