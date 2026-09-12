---
status: accepted
date: 2026-09-11
---

# BYOK-only model access with an app-side spend cap

The app hosts no model access at launch. Users supply their own provider keys, stored encrypted. The spending policy guards what the app itself pays for: a per-account cap on billable work counted in app-controlled units (Workers requests, Durable Object operations, D1 reads/writes, CPU time), checked before any billable work starts. At the cap, billable work stops, all accepted input and completed revisions remain available, an honest budget status is shown, and the user can raise the limit. Per-turn token usage appears in note details as the user's own provider cost. Hosted model access waits until there is pricing evidence.
