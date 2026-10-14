---
"@mj-biz-apps/accounting-entities": minor
---
Move the predictive-scoring bench (training pipelines, models, scoring record process and binding) from `metadata/` to `demo-data/`, so the install seed no longer carries untrained models or an `Active` monthly scoring job. The record process is now pushed `Disabled` with its schedule off. Load it with `pnpm run demo:load`.
