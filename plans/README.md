# plans/ — Accounting App Planning System

This directory contains the authoritative planning documentation for `bizapps-accounting`.

---

## Current Architecture & Plan Structure

| Path | Description |
|---|---|
| **`MASTER-PLAN.md`** | **The single canonical source of truth.** Unified Master Plan (v3) reflecting the complete, played-out target state of the repository (incorporating all schema rules, single-company isolation, role-based GL mapping, forward-dated rev-rec, preliminary/permanent batch locking, intercompany rules, workflows, scheduled actions, and AI agent catalogs). |
| **`action-plans/`** | Executable action plans for specific feature slices (e.g. S2 Batch Rework, UI primitives, etc.). Move to `completed/` when finished. |
| **`meetings/`** | Meeting decision notes and session transcripts. |
| **`supporting-documents/`** | Technical reference documents (e.g. ERD target specs). |
| **`archive-do-not-use/`** | **Legacy Overlay Archives.** Contains retired overlay files (`MASTER-PLAN-MODIFICATIONS.md`, `MASTER-PLAN-UPDATES.md`, `QUESTIONS.md`, `FEATURE-LIST.md`, `bizapps-accounting-master-plan-v2.md`, etc.) kept strictly for historical audit. **Do not read or update files in this folder for active development.** |

---

## Canonical Rule

`plans/MASTER-PLAN.md` is the **sole source of truth**. All future changes to architecture or scope must be updated directly in `plans/MASTER-PLAN.md` or executed via specific action plans in `plans/action-plans/`.
