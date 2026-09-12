---
status: accepted
date: 2026-09-11
---

# Cloudflare-owned persistence, online-first client

All note state is authoritative on Cloudflare: a Worker entry for auth and routing, D1 for accounts and the note directory, and one Durable Object per note holding the document, revisions, captures, and turn state. The client keeps only transient input and honest save/submission states; no IndexedDB, no offline command queue, no sync engine. Rejected offline-first because the target user captures on devices that are effectively always online, and a second source of truth would duplicate the hardest correctness problems (turn admission, revision history).
