---
status: accepted
date: 2026-09-11
---

# Think as the first runtime, with a defined exit

`@cloudflare/think` (experimental at the researched commit `c96418d`) is the initial conversation runtime inside the Note Agent. It owns transcript and execution bookkeeping; application-owned records keep the document, captures, and revision history, and its file tools must not offer a second way to overwrite the canonical document. The document/turn interface is written so a plain `streamText` loop inside the same Durable Object is a drop-in replacement. Exit criterion: if durable-submission recovery or cancellation misbehaves during the ten-step experiment, replace Think rather than patch around it.
