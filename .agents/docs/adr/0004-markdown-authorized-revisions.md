---
status: accepted
date: 2026-09-11
---

# Markdown documents with explicitly authorized revisions

Documents are plain Markdown (GFM), edited in a bare textarea in v1. The agent changes the document only when the user explicitly authorizes it: one automatic first draft, then user-triggered rewrites. Every revision records its author, a link to the authorizing message, and a one-line summary, and is shown as a word-level diff with additions and removals distinguishable without relying on color. Considered auto-revision after each clarifying answer; rejected because silent drift makes recovering from "that is not what I meant" the core failure mode of the product.
