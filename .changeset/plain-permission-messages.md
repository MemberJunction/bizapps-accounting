---
"@mj-biz-apps/accounting-core-entities-server": patch
"@mj-biz-apps/accounting-engine-base": patch
"@mj-biz-apps/accounting-ng": patch
---

Permission refusals no longer show authorization names or operation names. Building, regenerating, sending and re-dating journal entries, archiving a batch before approval, clearing a finance exception and deciding a manual journal entry each say what the person cannot do and who can (bc-aidp-next-golive#493). Messages that send a person to Finance or an administrator now ask politely ("Please request that Finance…", "Please ask your administrator to…"). `FinanceExceptionClearRuleRefusal` no longer takes the exception's type code.
