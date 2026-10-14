---
'@mj-biz-apps/accounting-entities': minor
---

Two finance exception types for orders' payment-gateway checks: `PROVIDER_REFUND_NOT_BOOKED` (a refund made at the gateway that orders could not book against the payment by itself) and `PROVIDER_CHARGE_MISMATCH` (a difference the charge reconciliation found between the gateway's charges and orders' payments). Shipped as metadata; they reach a host with the next Metadata_Sync.
