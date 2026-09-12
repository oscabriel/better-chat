# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase. This repo keeps domain docs under `.agents/docs/` instead of the repo root, and research references under `.agents/research/`.

## Before exploring, read these

- **`.agents/docs/CONTEXT.md`** (the repo has a single context; there is no `CONTEXT-MAP.md`).
- **`.agents/docs/adr/`**: read ADRs that touch the area you're about to work in.
- **`.agents/research/`**: prior research notes and proposals. Treat them as input, not as decisions; where a proposal conflicts with shipped code, the code wins until an ADR records a change.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## File structure

```
/
├── AGENTS.md
└── .agents/
    ├── docs/
    │   ├── CONTEXT.md
    │   ├── domain.md
    │   ├── issue-tracker.md
    │   ├── triage-labels.md
    │   └── adr/
    │       ├── 0001-....md
    │       └── 0002-....md
    └── research/
        ├── notebook-proposal.md
        ├── hermes-omp-reference.md
        └── hoplite-reference.md
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders), but worth reopening because…_
