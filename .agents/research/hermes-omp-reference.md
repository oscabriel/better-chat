# Lessons from Hermes Agent and Oh My Pi

Research date: September 11, 2026.

This is a source-backed reference for the [agent notebook proposal](notebook-proposal.md). Recommendations here are candidates for that design, not approved implementation changes.

## Summary

Hermes is most useful as a reference for personalization: separating reusable methods from personal facts, loading skills when relevant, and retaining the corrections that make an agent better suited to a particular user.

Oh My Pi, or OMP, is most useful as a reference for interaction control: steering versus follow-up, switching roles within a session, limiting reviewer noise, and maintaining a compact working record without discarding recoverable history.

Neither suggests that Better Chat needs concurrent editors, a local-first database, or a different execution platform. Keep Cloudflare Agents SDK and Think as the proposed runtime. Borrow specific behaviors and their tests rather than transplant either application.

The strongest product lesson is that a personal agent should learn how to help the user think, without turning every tentative thought into a permanent fact about them.

## Research method and scope

I inspected these durable Replicant clones:

| Repository | Local checkout | Inspected commit |
| --- | --- | --- |
| NousResearch/hermes-agent | `~/Developer/clones/github.com/NousResearch/hermes-agent` | `31d0a2428e9db346d6781da66f5b37ff3e12def2` |
| can1357/oh-my-pi | `~/Developer/clones/github.com/can1357/oh-my-pi` | `f18f8d7038c32a0426fadb99079f33f9cef7268c` |

Hermes was missing locally. GitHub reported a large repository, so I created a shallow, blob-filtered sparse clone. The checkout includes root files and `agent/`, `tools/`, `gateway/`, `docs/`, `tests/`, and `hermes_cli/`.

OMP already existed and was clean. I updated it with a fast-forward pull. Both clones were clean after inspection. Both root projects declare MIT licensing; check notices and individual files before copying code.

This was a targeted source review of memory, skills, context, turn control, and selected tool policies. Tests cited below were read, not executed. I did not install dependencies, run either application, benchmark quality, or perform a full security audit. Provider adapters, terminal execution, browser automation, and multiplayer transports were not comprehensively inspected.

The manifests report Hermes `0.21.2` and OMP coding-agent `18.1.17` at these commits. These are source-manifest versions, not a verification of the latest published releases. [H0] [O0]

## 1. Learn ways of thinking separately from facts about the user

### Source behavior

Hermes distinguishes its bounded `MEMORY.md` and `USER.md` stores from skills. Its memory tool description directs task-specific procedures and corrections into the relevant skill rather than the always-loaded profile. Default store limits are 2,200 and 1,375 characters respectively. Those are deliberately small prompt inputs, not a complete archive. [H1] [H2]

The background skill-review prompt treats corrections to tone, format, and workflow as signals to improve the skill that governed that class of work. Its explicit `/learn` operation turns a user-described workflow or source into a reusable skill through an ordinary agent turn. Skill discovery and full skill loading are separate operations. [H3] [H4] [H5]

This is an implementation of prompt and skill adaptation, not model-weight training or proof that quality always improves.

### Application to Better Chat

Separate these cases:

- "When I am exploring an idea, ask one question at a time." This is a reusable interaction preference.
- "In this note, I want to explore the less conventional option." This is note-local direction.
- "Maybe I should stop managing people." This is an unresolved thought, not a permanent personal fact.

A useful product behavior would be to offer to remember a method after an explicit correction or a successful session. For example, "Use this approach next time I am working through a decision."

Store the method with its scope, version, and a link to the originating interaction. Let the user inspect, edit, disable, or remove it. Begin with instructions and templates, not executable scripts.

Do not copy Hermes' pressure to find a skill update in most sessions. Its review prompt explicitly pushes toward activity. Thought work needs a stronger permission to leave uncertainty unresolved and save nothing. [H3]

## 2. Keep an agent working brief separate from the user's note

### Source behavior

OMP has an opt-in experimental `context_notes` mechanism. It stores a compact notebook in the session journal, finds the latest valid revision on the current branch, and uses that record during context reconstruction. It has a 16 KiB UTF-8 limit. The agent can read full historical entries through `history://current/full` when the brief is insufficient. [O1] [O2] [O3]

The write implementation checks cancellation and session ownership, awaits persistence preparation, then checks ownership and the active branch again before appending and flushing. The tests cover oversized writes, resume, and a branch change while preparation is pending. [O1] [O4]

Importantly, this is the agent's working memory. It is not a user-authored notebook application. Its prompt describes the brief as a convenience record, not authority. [O5]

### Application to Better Chat

Our note should have two different kinds of text:

1. The user-facing document, representing the current expression of the idea.
2. A compact agent working brief, preserving conversational context needed to help with that document.

A working brief might retain:

- The unresolved question.
- The user's latest correction.
- Alternatives already considered and why they were set aside.
- What remains tentative.
- References to the original captures and relevant exchanges.

Do not use the polished document alone as memory. It may intentionally omit the discarded possibilities that explain why the user reached the current wording.

The brief can live in the same Note Agent's SQLite storage. It requires no new agent, local database, or general event-sourcing system. Treat it as derived and replaceable. If it conflicts with the user's current instruction or source capture, correct the brief.

Do not copy OMP's byte limit as a product requirement. Measure an appropriate context budget with actual notes.

## 3. Make correction a first-class interaction

### Source behavior

OMP's agent core maintains distinct steering and follow-up queues. Steering changes the active work at an execution boundary. Follow-up waits until the agent has finished its current work. The session layer also has regression coverage for two prompt submissions racing during asynchronous preparation. [O6] [O7]

Hermes distinguishes a hard stop, a queued steer, and a redirect. Redirect can cancel the current model request and incorporate a correction without treating it as a separate task. During tool execution it falls back to steering rather than indiscriminately killing the tool. [H6]

### Application to Better Chat

Consider the user interrupting a draft with:

> "No, I am not asking whether I should quit. I am trying to understand why I feel stuck."

That is a correction to the current interpretation, not another item to answer after finishing the wrong draft.

The product needs clear semantics for:

- Correct the current direction.
- Add something for the next turn.
- Stop and return control to the user.

The interface need not expose three technical commands. A correction can initially use a dependable stop-and-resubmit path if Think does not offer the desired steering behavior. The important part is preserving the correction as actual user input and preventing the stopped turn from applying a late rewrite.

These are sequential operations. No simultaneous editors are required. Pending input accepted by the server belongs in Cloudflare storage, not an IndexedDB queue.

Verify the selected Think release's behavior before implementing another queue around it. There should be one owner for turn admission and cancellation.

## 4. Preserve the latest human intent through compaction

### Source behavior

Hermes has explicit code to preserve human intent when compaction removes the active user request. It distinguishes real user input from synthetic user-role messages and can restore the most recent correction carried through its steering mechanism. Its regression tests check that an older request does not replace a newer correction after compression. [H7] [H8]

OMP's full-history reader renders durable entry identifiers and context-window boundaries instead of treating the compacted model context as the only history. [O3]

### Application to Better Chat

Compaction quality is a product concern, not merely a token-saving concern.

If a user says "Keep this exploratory; do not turn it into a plan," that instruction must survive a long session. Losing it can produce a technically coherent document that is wrong for the user.

Store current explicit direction separately from lossy summaries, with a reference to its source message. During context reconstruction, retain the latest relevant correction and the current document revision.

Tests should exercise semantic continuity as well as persistence:

- An unresolved possibility remains unresolved after compaction.
- A rejected interpretation does not return as the user's belief.
- The latest correction outranks an older task description.
- Restoring context does not replay a historical request as new work.

This does not mean copying Hermes' provider-specific role-repair logic. Use the maintained runtime for transcript mechanics and add notebook-specific continuity checks around it.

## 5. Retrieve original evidence rather than repeatedly summarizing summaries

### Source behavior

Hermes' current `session_search` returns actual database messages. It supports discovery, anchored windows, reading a session, and browsing. Results carry roles, message identifiers, source information, and truncation markers. Discovery hides helper sessions and demotes cron sessions so generated automation history does not crowd out interactive conversations. [H9]

Tests cover interactive sessions outranking repetitive cron content while retaining cron content when it is the only match. [H10]

OMP's history reader similarly makes the persisted record available independently of the shortened prompt context. [O3]

### Application to Better Chat

When an agent says "You previously rejected this because...", it should be able to point to the exchange that supports the claim.

Provide small, scoped history operations that return original captures or messages with stable references. Fetch the surrounding exchange when a single sentence would be misleading.

Start inside the current note. Cross-note search remains a later permission and product decision. Nothing here requires a vector database or universal memory service.

If cross-note search arrives, distinguish user captures, user-endorsed document versions, agent drafts, and derived summaries. Do not let a large amount of generated text overwhelm the relatively small amount the user actually said.

Generated material can still be useful evidence of the process. It should not automatically count as evidence of the user's beliefs.

## 6. A perspective changes behavior and permissions, not just the avatar

### Source behavior

OMP's plan-mode model transition is an explicit policy. It can change the active session's model or thinking setting and defers a model switch while streaming. It does not require spawning another persistent agent just to use a different role. [O8]

Its write/edit plan-mode guard also checks actual targets. It permits the session's plan artifacts while rejecting working-tree writes, deletes, and renames on that path. This is a concrete enforcement mechanism, not just a prompt saying "do not edit." It is not, by itself, evidence of a complete sandbox across every tool. [O9]

Hermes' background-review guards distinguish agent-managed skills from protected or user-owned skills and require a fresh read before particular review writes. A regression test checks that a skill-only review does not receive the memory tool merely because memory exists elsewhere in the profile. [H11] [H12]

### Application to Better Chat

A small perspective definition can specify its instructions, optional model, and permitted operations:

- Discuss: read the note and respond without changing the document.
- Shape: revise the document in response to the user's request.
- Challenge: question an assumption without silently rewriting the conclusion.
- Research: gather evidence with a bounded tool set when requested.

These are candidate behaviors, not a required four-mode toolbar. Their value is that the Note Agent can enforce what the current turn may do.

Record the active perspective and version with the turn. Switch at a safe turn boundary. Tool execution should still check the active turn and permission at the write, even if the model received a restricted tool list.

Do not add a hidden reviewer to every exchange. The user's stated model is agents taking turns with them.

## 7. Bound criticism and preserve the meaning of stop

### Source behavior

OMP's advisor subsystem contains an emission guard because prompt instructions were insufficient to prevent repetitive advice. The code normalizes text, filters specific content-free phrases, deduplicates notes, and limits non-blocker emissions per update. The inspected implementation defaults to four non-blockers and exempts blockers from that particular budget. Tests cover these rules. [O10] [O11]

Its delivery policy can preserve late advice as a visible record instead of starting another turn. It distinguishes a deliberate user interrupt from an ordinary agent yield and has special handling for modes that should remain user-driven. [O12]

### Application to Better Chat

A thinking companion should not manufacture an endless supply of objections. After a requested challenge, return the useful objection and let the user decide whether to continue.

Borrow the mechanism of host-enforced limits, not OMP's exact severity taxonomy or default counts:

- Bound tool calls and revision attempts per turn.
- Do not repeatedly present the same objection unless the user reopens it or the underlying idea changes.
- Let "nothing further to add" end a review.
- Never restart a stopped session because another agent wants to add a point.
- Do not treat disagreement with the user's preference as a system-level blocker.

Exact-text deduplication catches only a narrow class of repetition. Semantic repetition and whether a question is useful need product evaluations, not claims that a string filter solves them.

## 8. Make personalization reversible and cheap enough to justify

### Source behavior

Hermes records skill mutations with actor attribution and before/after file manifests, with content-addressed backups and a rollback path. The ledger is best-effort telemetry for ordinary mutations, not a transactional guarantee that every successful skill write has an audit entry. [H13]

Its background reviews are bounded but still substantial extra model work. The inspected code has a 16-iteration limit and a default aggregate input-token budget of 600,000 for a review fork. Foreground work requests cancellation and proceeds after a bounded wait rather than letting background maintenance block the user. These limits describe code, not measured typical consumption. [H3]

Hermes also freezes its built-in memory prompt snapshot at load time to preserve prefix-cache reuse. Later store writes do not immediately rewrite that snapshot. [H1] [H14]

### Application to Better Chat

Start with explicit "remember this approach" actions and note-local corrections. Add autonomous maintenance only if its measured value warrants the extra latency, cost, and privacy implications.

When a saved thinking method changes, preserve its prior version and the reason for the change. For our small structured records, version persistence should be part of the successful write, not optional telemetry.

Keep stable instructions separate from changing note context to avoid needless prompt churn. But do not freeze the current document or ignore an explicit preference correction to preserve a cache hit. Correctness comes first; the exact cache arrangement must follow the chosen runtime and provider.

## Where I would deliberately diverge

### Memory should not outrank the person

Hermes' external memory wrapper labels recalled material as authoritative reference data. OMP's inspected memory and context-note prompts instead say that current instructions and evidence outrank memory. [H15] [O5] [O13]

For Better Chat, use the latter rule. A memory system is a fallible account of prior interaction, particularly when the user is thinking aloud. A current correction must win.

This compares the inspected prompt constructions, not every trust decision in either application.

### Do not import the whole runtime

Hermes is a Python application with extensive local tooling and multiple execution backends. OMP's coding-agent package depends on Bun and packages for native operations and terminal UI. Their entire applications are not drop-in Cloudflare Worker libraries. [H0] [O0]

Neither review provides a reason to replace Cloudflare's lifecycle with a port of those systems. We need notebook-specific context and tool behavior on top of the chosen runtime.

### Do not treat marketing as measured evidence

Hermes describes itself as self-improving, and OMP publishes capability and benchmark claims in its README. This review establishes that specific adaptation and control mechanisms exist. It does not establish superiority, improved thought quality, or performance on Better Chat's intended use cases.

## Recommended additions to the proposal

The overall architecture can stay unchanged. I would bring these design questions into the next discussion:

| Priority | Addition | First useful scope |
| --- | --- | --- |
| First | Explicit correction and stop semantics | Correct a draft without accepting a late rewrite from the stopped turn |
| First | Compact note-local working brief | Preserve unresolved questions and the latest correction without replacing original captures |
| First | Perspective-specific write permission | Discuss and challenge without granting document edits |
| Next | Source-linked recall inside a note | Recover the exchange behind a remembered preference or rejected option |
| Next | User-approved reusable thinking methods | Save how to conduct a kind of session, with version history and scope |
| Later | Background personalization | Only after measuring benefit, spend, and failure modes |

An especially useful evaluation would take a long, messy session, force context compaction, change perspective, and then ask the agent to explain what the user has not decided yet. A second evaluation should interrupt a confident but mistaken rewrite with a correction and check that the next document reflects that correction.

No changes to `notebook-proposal.md` or application source were made as part of this research.

## Source record

All links are pinned to the inspected commits. Line ranges identify the most relevant passages; some linked files contain additional behavior outside this review.

### Hermes

- H0. [Manifest][H0], Python requirements and application dependencies.
- H1. [Memory store, lines 65 through 134][H1], bounded stores and frozen prompt snapshot.
- H2. [Memory tool, lines 262 through 293][H2], global facts versus task skills.
- H3. [Background review][H3], cancellation, budgets, and memory/skill review prompts. Relevant ranges are 112 through 203 and 295 through 459.
- H4. [Explicit learn prompt][H4], user-driven skill generation through the existing tool path.
- H5. [Skill discovery and viewing][H5], metadata discovery separate from full content.
- H6. [Interrupt control, lines 191 through 293][H6], stop, steering, and redirect behavior.
- H7. [Conversation compression, lines 2089 through 2153][H7], restoration of human intent.
- H8. [Busy-steer compaction tests][H8], latest correction versus historical request.
- H9. [Session search, lines 1 through 280][H9], original messages, lineage, metadata, source filtering, and ranking.
- H10. [Session search tests, lines 604 through 628][H10], interactive and cron ranking.
- H11. [Skill write guards, lines 166 through 244][H11], ownership and read-before-write checks.
- H12. [Background review memory-scope tests][H12], limiting tools to the requested review purpose.
- H13. [Skill ledger][H13], attributed before/after records and rollback. Ordinary ledger writes are best-effort.
- H14. [System-prompt assembly][H14], stable, context, and volatile prompt inputs.
- H15. [Memory context wrapper, lines 270 through 285][H15], treatment of recalled context.

### OMP

- O0. [Coding-agent manifest][O0], Bun and native/TUI dependencies.
- O1. [Context tools, lines 40 through 141][O1], ownership, size checks, cancellation, and persisted writes.
- O2. [Context-note projection][O2], latest revision and reset behavior.
- O3. [History reader, lines 192 through 253][O3], durable identifiers and full-history rendering.
- O4. [Context-note tests][O4], resume, ownership, and delayed-write checks.
- O5. [Context-note prompt][O5], working context is not authority.
- O6. [Agent queues, lines 991 through 1084][O6], steering and follow-up.
- O7. [Prompt dispatch race test][O7], sequential handling of racing submissions.
- O8. [Plan model transition][O8], safe role/model changes within a session.
- O9. [Plan-mode write guard, lines 125 through 155][O9], enforcement at the write interface.
- O10. [Advisor emission guard][O10], noise, duplicate, and budget rules.
- O11. [Advisor emission tests][O11], executable specifications for those rules.
- O12. [Advisor delivery, lines 1217 through 1322][O12], steering versus preserving advice.
- O13. [Local memory guidance prompt][O13], precedence of live evidence and current instruction.

### Documentation drift noticed

Hermes' README describes session recall with LLM summarization, but the inspected `session_search_tool.py` says and implements database-message retrieval without a summarizing model call in that tool.

OMP's advisor documentation describes one accepted note per update, but the inspected emission guard and tests implement a configurable default of four non-blockers with a blocker exemption.

The conclusions above follow implementation and tests rather than those older descriptions.

[H0]: https://github.com/NousResearch/hermes-agent/blob/31d0a2428e9db346d6781da66f5b37ff3e12def2/pyproject.toml
[H1]: https://github.com/NousResearch/hermes-agent/blob/31d0a2428e9db346d6781da66f5b37ff3e12def2/tools/memory_tool_store.py#L65-L134
[H2]: https://github.com/NousResearch/hermes-agent/blob/31d0a2428e9db346d6781da66f5b37ff3e12def2/tools/memory_tool.py#L262-L293
[H3]: https://github.com/NousResearch/hermes-agent/blob/31d0a2428e9db346d6781da66f5b37ff3e12def2/agent/background_review.py
[H4]: https://github.com/NousResearch/hermes-agent/blob/31d0a2428e9db346d6781da66f5b37ff3e12def2/agent/learn_prompt.py
[H5]: https://github.com/NousResearch/hermes-agent/blob/31d0a2428e9db346d6781da66f5b37ff3e12def2/tools/skills_tool.py
[H6]: https://github.com/NousResearch/hermes-agent/blob/31d0a2428e9db346d6781da66f5b37ff3e12def2/agent/interrupt_control.py#L191-L293
[H7]: https://github.com/NousResearch/hermes-agent/blob/31d0a2428e9db346d6781da66f5b37ff3e12def2/agent/conversation_compression.py#L2089-L2153
[H8]: https://github.com/NousResearch/hermes-agent/blob/31d0a2428e9db346d6781da66f5b37ff3e12def2/tests/agent/test_compression_busy_steer_anchor.py
[H9]: https://github.com/NousResearch/hermes-agent/blob/31d0a2428e9db346d6781da66f5b37ff3e12def2/tools/session_search_tool.py#L1-L280
[H10]: https://github.com/NousResearch/hermes-agent/blob/31d0a2428e9db346d6781da66f5b37ff3e12def2/tests/tools/test_session_search.py#L604-L628
[H11]: https://github.com/NousResearch/hermes-agent/blob/31d0a2428e9db346d6781da66f5b37ff3e12def2/tools/skill_manager_guards.py#L166-L244
[H12]: https://github.com/NousResearch/hermes-agent/blob/31d0a2428e9db346d6781da66f5b37ff3e12def2/tests/agent/test_background_review_memory_scope.py
[H13]: https://github.com/NousResearch/hermes-agent/blob/31d0a2428e9db346d6781da66f5b37ff3e12def2/tools/skill_ledger.py
[H14]: https://github.com/NousResearch/hermes-agent/blob/31d0a2428e9db346d6781da66f5b37ff3e12def2/agent/system_prompt.py
[H15]: https://github.com/NousResearch/hermes-agent/blob/31d0a2428e9db346d6781da66f5b37ff3e12def2/agent/memory_manager.py#L270-L285
[O0]: https://github.com/can1357/oh-my-pi/blob/f18f8d7038c32a0426fadb99079f33f9cef7268c/packages/coding-agent/package.json
[O1]: https://github.com/can1357/oh-my-pi/blob/f18f8d7038c32a0426fadb99079f33f9cef7268c/packages/coding-agent/src/tools/context-notes.ts#L40-L141
[O2]: https://github.com/can1357/oh-my-pi/blob/f18f8d7038c32a0426fadb99079f33f9cef7268c/packages/coding-agent/src/session/context-notes.ts
[O3]: https://github.com/can1357/oh-my-pi/blob/f18f8d7038c32a0426fadb99079f33f9cef7268c/packages/coding-agent/src/internal-urls/history-protocol.ts#L192-L253
[O4]: https://github.com/can1357/oh-my-pi/blob/f18f8d7038c32a0426fadb99079f33f9cef7268c/packages/coding-agent/test/context-notes.test.ts
[O5]: https://github.com/can1357/oh-my-pi/blob/f18f8d7038c32a0426fadb99079f33f9cef7268c/packages/coding-agent/src/prompts/system/context-notes.md
[O6]: https://github.com/can1357/oh-my-pi/blob/f18f8d7038c32a0426fadb99079f33f9cef7268c/packages/agent/src/agent.ts#L991-L1084
[O7]: https://github.com/can1357/oh-my-pi/blob/f18f8d7038c32a0426fadb99079f33f9cef7268c/packages/coding-agent/test/agent-session-prompt-dispatch-race.test.ts
[O8]: https://github.com/can1357/oh-my-pi/blob/f18f8d7038c32a0426fadb99079f33f9cef7268c/packages/coding-agent/src/plan-mode/model-transition.ts
[O9]: https://github.com/can1357/oh-my-pi/blob/f18f8d7038c32a0426fadb99079f33f9cef7268c/packages/coding-agent/src/tools/plan-mode-guard.ts#L125-L155
[O10]: https://github.com/can1357/oh-my-pi/blob/f18f8d7038c32a0426fadb99079f33f9cef7268c/packages/coding-agent/src/advisor/emission-guard.ts
[O11]: https://github.com/can1357/oh-my-pi/blob/f18f8d7038c32a0426fadb99079f33f9cef7268c/packages/coding-agent/test/advisor/emission-guard.test.ts
[O12]: https://github.com/can1357/oh-my-pi/blob/f18f8d7038c32a0426fadb99079f33f9cef7268c/packages/coding-agent/src/session/session-advisors.ts#L1217-L1322
[O13]: https://github.com/can1357/oh-my-pi/blob/f18f8d7038c32a0426fadb99079f33f9cef7268c/packages/coding-agent/src/prompts/memories/read-path.md
