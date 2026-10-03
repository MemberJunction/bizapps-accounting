---
"@mj-biz-apps/accounting-core-entities-server": patch
---

The journal entry anomaly models no longer carry `ArtifactFileID` in `metadata/ml-models/.ml-models.json`. The key was set to null, and push writes every key it finds, nulls included, so pushing to the host where a model was trained cleared its link to the trained artifact. With the key absent, a fresh database gets null and an existing value is left alone. `ml-models/.mj-sync.json` now excludes `ArtifactFileID` on pull so the next pull does not write the File ID back (bizapps-accounting#222).

The `Validate Changes` workflow now fails when a folder under `metadata/` is missing from `directoryOrder` in `metadata/.mj-sync.json`.
