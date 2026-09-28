---
"@mj-biz-apps/accounting-core-entities-server": patch
---

`metadata/.mj-sync.json` now lists `record-processes`, `ml-training-pipelines`, `ml-models` and `ml-model-scoring-bindings` in `directoryOrder`. Folders left out of the list are pushed afterwards in alphabetical order, so on a fresh database `ml-model-scoring-bindings` was pushed before the models and record process it references, and `mj sync push --dir metadata` rolled back on `FK_MLModelScoringBinding_MLModel`. The new order follows the foreign keys: a model references its pipeline, and a scoring binding references its model and record process.
