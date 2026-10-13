# demo-data

Records for a development or demo database. They never ship: the release `Metadata_Sync` migration
is generated from `metadata/` only. Load them after `metadata/` with:

```bash
pnpm run demo:load
```

## Predictive-scoring bench

`ml-training-pipelines/`, `ml-models/`, `record-processes/` and `ml-model-scoring-bindings/` hold
the Predictive Studio setup for Journal Entry anomaly scoring: the training pipelines, two `Draft`
models, and the record process and binding that write `PredictedAnomalyProbability`,
`PredictedAnomalyRiskBand` and `PredictedAnomalyScoredAt` back to `JournalEntry`.

They live here, not in `metadata/`, because a fitted model belongs to the data it was fitted on
(issue #372). The models have no trained artifact, so the record process is pushed `Disabled` with
its schedule off: a scheduled run against a model with no artifact marks every journal entry
`Failed` (MemberJunction/MJ#4829). Train a model in Predictive Studio before enabling it.

The folders sit directly under `demo-data/` because MetadataSync discovers only immediate
subfolders of the pushed directory. Their push order is in `.mj-sync.json`.
