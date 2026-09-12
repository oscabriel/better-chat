---
status: accepted
date: 2026-09-11
---

# Sequential turns per note, enforced by the server

Each note has one active agent turn at a time and one persistent agent session; perspectives (thinking partner, challenge) change instructions and permissions for the next turn rather than spawning independent agents. The server, not the client, enforces turn admission, cancellation, and the guarantee that a stopped turn cannot commit a late revision after the user takes over. Chosen over concurrent or collaborative agent editing because the product is one person thinking, and correction needs an unambiguous last writer.
