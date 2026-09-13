# Better Chat as an agent notebook

## Status and scope

This proposal records the product direction and high-level architecture discussed with the user. It is a basis for further design, not authorization to implement the application or deploy infrastructure.

The product direction is individual thought work: personal agents that live in your notebook, organized around pressing decisions and ideas that are not fully formed yet. The ideas belong to the user. Agents help the user make sense of them, express them, and challenge them.

Positioning, set during the grilling session: Thinkspace (this project's product name, replacing Better Chat) is an agent harness for deep thought. Not knowledge work, not research, not coding. Deep thought is what comes before all of that: figuring out what the right thing to work on is, before spending effort working on the wrong thing. Everything downstream of that decision is out of scope; the notebook is the upstream tool.

The existing Better Chat application is inspiration and a possible source of reusable code. Its architecture, dependencies, and data model are not constraints. A fresh application is acceptable. Every retained dependency needs review and an update to its current compatible release before implementation.

This proposal supersedes the earlier emphasis on a delegated-work management inbox. It also removes the earlier suggestions for concurrent agent editing, a local IndexedDB database, and a separate Notebook Agent.

The first version should prioritize correcting a mistaken interpretation, reviewing and undoing revisions, and keeping personal memory within user-confirmed boundaries. Broad cross-note search and automatic background personalization are deferred. These priorities incorporate the Hermes, OMP, and Hoplite research without changing the architecture or authorizing implementation.

## Product concept

A user creates a note by writing or speaking whatever is on their mind. The input can be messy, repetitive, contradictory, or incomplete. An agent shapes it into a useful first draft and starts a conversation about what still needs clarification.

The user and agent then work through the idea together. Another agent perspective can join when useful, but they take turns. The user can correct the interpretation, ask for a rewrite, explore a counterargument, or stop when the note says what they mean.

The defining interaction is:

> Capture an unfinished thought. Let an agent help shape it. Talk it through until the result feels like your idea, expressed clearly.

This is not primarily a task manager, an autonomous research service, or a control panel for all of a person's agents. Research and other tools can support the discussion, but producing more agent activity is not the goal.

### Why a notebook

A conversation records the path taken. A note records the current expression of the idea.

The user should be able to return to the note without rereading an entire chat. Conversation remains available as context, but the current document is the main result of the work.

Different notes can have different shapes. A decision may need options and trade-offs. An emerging idea may need a few paragraphs and one unresolved question. Do not force every thought into a fixed decision template.

### Why an inbox

An inbox is a useful entry point for unfinished thought. It can show new captures, notes with a question waiting, and recently active ideas.

It should not become a dashboard of agent runs. Execution status belongs inside the relevant note or in a small status indicator. The home screen should help the user choose what to think about next.

### Why mobile first

People often capture and develop ideas away from their desk. The application should support short writing sessions, voice capture, readable documents, and interrupted use.

Mobile first does not mean offline first. The initial application is online-first, with Cloudflare as the authoritative persistence layer. Desktop remains useful for longer writing and review.

## A representative session

1. The user opens a new note and writes or records a rough thought.
2. The application saves the capture to Cloudflare and confirms receipt.
3. The agent produces a first working document, attributed as an agent-shaped draft.
4. The agent asks a focused question rather than generating an unsolicited questionnaire.
5. The user answers or says that the draft missed the point.
6. The agent revises the document or continues the discussion without changing it.
7. The user requests a different perspective, such as a challenge to an assumption.
8. That perspective takes the next turn using the note's relevant context.
9. The user accepts the direction, edits the wording, or continues exploring.
10. The user leaves the note open, rests it for later, or marks it settled for now.

An agent finishing a turn does not mean the user has finished thinking. A settled note can be reopened.

## Product records

These terms describe the proposed model. They are not a final database schema.

| Record | Meaning |
| --- | --- |
| Note | The durable home for one developing idea, question, or decision |
| Capture | Original user input, including text, recordings, and attachments |
| Document | The current editable expression of the note |
| Conversation | The exchanges through which the user develops the note |
| Revision | A saved document version with its author, time, and reason for change |
| Turn | One admitted agent response, including any authorized document revision |
| Perspective | The instructions, skill, and optional model used for a turn |

Keep note state separate from execution state. A note can be open, resting, settled, or archived regardless of whether its latest turn succeeded or failed. Exact labels remain a UX decision.

The current document is authoritative for the note's content. The transcript is not a substitute for it, and streamed tokens are not the persistence format for document edits.

## Authorship and document changes

The original capture must remain available through subsequent rewrites. The user needs a reliable way to say, "That is not what I meant," and recover the language that prompted the discussion.

Preserving originals does not mean retaining them against the user's wishes. Export, explicit deletion, and account deletion must cover captures as well as derived documents.

Agent-shaped wording should not silently become a claim that the user endorses every inference in it. The application should distinguish user input from generated text through revision attribution and clear presentation. A formal approval workflow for every paragraph is not required.

Expected behavior:

- Initial shaping creates a first draft automatically.
- An explicit rewrite request authorizes a reversible document change.
- Discussion can happen without changing the document.
- New claims and uncertain interpretations should be visible as such.
- The user can undo a rewrite or return to an earlier version.
- Agents should preserve ambiguity when the user has not resolved it.

Each completed agent rewrite should offer a readable comparison with the previous document, with additions and removals distinguishable without relying on color alone. On mobile, the comparison must work without side-by-side panes. The user can inspect the changes, keep writing, or undo the rewrite. An authorized rewrite can become the current document immediately; review does not introduce a mandatory acceptance queue. An agent's summary of what changed is useful context, not a substitute for the comparison.

Keep the original capture accessible during review so the user can check an uncertain interpretation against their own words.

A constrained block editor may be useful for mobile editing and section-level changes, but the document format and editor library are not yet selected. Stable exports matter more than an elaborate document model.

## Sequential interaction, not collaborative editing

There is one active agent turn per note. Different notes can operate independently, but agents do not concurrently rewrite the same note.

Several named perspectives do not necessarily require several independently running agents. Start with one persistent note session whose instructions or model can change for the next turn. Use separate child agents only if a later workflow needs genuinely independent execution.

Possible perspectives include an editor, a challenger, and a researcher. These are examples, not a required roster or a marketplace plan. A discussion-only or challenge turn does not have document-write permission. Record the active perspective with the turn and enforce its permissions when a tool attempts a change, not only through prompt instructions.

When an agent revises the document, direct editing can pause. The user can stop the agent and take over. The interface should make that transition clear rather than mixing partial agent output into active user edits.

The server must enforce turn admission, not just disable a button in one browser tab. Duplicate requests must not start duplicate turns. A stopped or superseded turn must not apply a late document rewrite after the user takes over.

### Correction, follow-up, and stop

Distinguish a correction to the current interpretation from an addition for the next turn. "No, I am trying to understand why I feel stuck" must not wait behind a rewrite based on the rejected interpretation.

Start with stop-and-resubmit for corrections unless the selected Think release provides suitable steering. Preserve the correction as user input before starting the replacement turn. Use the runtime's admission and cancellation mechanisms rather than adding a competing queue.

Show "Stopping" after the server accepts cancellation and "Stopped" after it confirms completion. Editing resumes only when the server can guarantee that the cancelled turn cannot commit a rewrite. Preserve already completed revisions and show any incomplete response as interrupted, not as a completed document change.

If the application accepts follow-up input during a turn, save it on the server and show that it is queued. Let the user remove it before it starts. Stopping must not silently launch pending input; keep it visible until the user chooses to continue or discard it. Stop-and-take-over must never trigger another turn by itself.

### Stale edits

Simple revision checks remain useful protection against stale writes from another tab. They do not imply automatic merging, CRDTs, or a distributed collaboration engine. If a conflict occurs, preserve the user's unsaved text and explain that a newer version exists.

### Excluded interaction machinery

Do not build:

- Concurrent writers inside one note.
- Agent edit branches and merge machinery.
- Automatic round-robin debates between agents.
- A formal contribution approval queue for ordinary conversation.
- A different long-lived runtime for every named perspective.

## Cloudflare architecture

```text
Mobile-first web application
          |
Cloudflare Worker
Authentication and routing
          |
          +-- D1
          |   Accounts and preferences
          |   Note directory and inbox metadata
          |
          +-- Note Agent, one per note
              Cloudflare Agents SDK + Think
              |
              +-- Durable Object SQLite
              |   Current document and revisions
              |   Captures and conversation
              |   Turn state and execution bookkeeping
              |
              +-- R2
                  Audio and attachments
                  Large files and exports
```

### Worker entry

The Worker authenticates requests, checks note ownership, and routes them to the correct Note Agent. A guessed note identifier must not grant access.

HTTP commands, WebSocket connections, attachment access, and any later external-agent interface need the same ownership rules. Framework routing does not replace authorization.

### Note Agent

One Note Agent instance owns each note. It coordinates conversation and document changes and persists the note's state in Durable Object SQLite.

Use the Cloudflare Agents SDK directly. Evaluate `@cloudflare/think` as the initial conversation runtime rather than creating a custom model loop, transcript store, and recovery scheduler.

Think should own its transcript and execution bookkeeping. Application-owned records should own the document, captures, and revision history. Avoid duplicating either concern into a competing store.

Document changes go through a small application interface that records a revision and checks the active turn. If Think's workspace is enabled, its file tools must not provide a second way to overwrite the canonical document.

Keep framework subclasses thin where practical. Document rules, context selection, and validation can remain ordinary functions.

### D1

D1 stores account data, preferences, and the note directory used to render the inbox. It can also hold connector metadata if integrations become part of the product.

Opening the inbox should not require contacting every Note Agent. Keep enough directory metadata to list and sort notes, such as title, state, preview, and update time.

A directory entry is not a second authoritative copy of the document. Updates between a Note Agent and D1 can fail independently, so the implementation needs retryable metadata updates and a way to repair stale entries. Do not assume a transaction spans both databases.

A separate Notebook Agent is unnecessary for the initial product. Listing notes and loading preferences do not require another LLM-backed runtime.

### R2

R2 holds recordings, attachments, and other large files. SQLite records refer to these objects rather than embedding their bytes in document state.

Uploads need ownership checks, size limits, and cleanup for incomplete or abandoned uploads. Audio retention should be an explicit product choice.

## Thin, online-first client

Cloudflare is the source of truth. The initial client does not maintain an IndexedDB database, offline command queue, or local synchronization engine.

The client keeps transient input and optimistic display state in memory. It loads notes from the server, autosaves edits, submits messages, and subscribes to live updates.

The interface must distinguish:

- Input that has not reached the server.
- A save or submission in progress.
- A save or submission confirmed by the server.
- A connection failure that prevented saving.

Cloudflare can preserve accepted input. It cannot preserve text or audio that never reached it. Do not imply offline durability or show "saved" before acknowledgement.

After a disconnect, reload authoritative document and turn state and resume the runtime's supported stream behavior. Do not depend on receiving every token event to recover a note.

A progressive web application is the starting client proposal. Test recording, uploads, installation, and app suspension on actual mobile browsers before promising behavior. Native applications and offline capture remain possible later additions, not requirements of this architecture.

## Context and memory

Each turn should receive the current document, relevant original captures, recent discussion, and any explicitly selected supporting material. Long conversations need bounded context, but model summaries must not replace the source records.

### Preserve intent within the note

Retain the latest explicit correction and its source message when reconstructing context. A compact, derived working brief can preserve unresolved questions and rejected interpretations, but it must not become a second authoritative document. Prefer the runtime's existing context facilities and retain access to the original exchanges.

Recall should begin inside the current note. When the agent cites an earlier decision or correction, it should link to the supporting capture or exchange. Retrieve surrounding context when an isolated sentence would misrepresent the user's intent. A summary or generated draft is not evidence that the user endorsed its claims.

### User-confirmed personal memory

Start with explicit "remember this approach" actions or an offer the user confirms. Save stable interaction preferences and reusable thinking methods separately from note-local direction. "Ask one question at a time when I am exploring an idea" can be a preference. "In this note, explore the unconventional option" stays in that note.

Do not save tentative thoughts, unresolved possibilities, sensitive personal facts, secrets, raw transcripts, or temporary note state as global memory. Never infer preferences from agent output, tool results, or imported material. "Maybe I do not want to manage people" is a tentative thought, not permission to write "dislikes management" into a global profile.

Saved preferences should have a scope and source reference. Let the user inspect, edit, disable, or delete them. Preserve previous versions when updating a preference, but explicit deletion must remove those retained versions too. Defer autonomous background curation until its value and cost justify it.

Each turn starts with a snapshot of the applicable preferences. Memory edits apply to subsequent turns rather than silently changing one already running. Explain that deleting a preference cannot retract context already sent to a model; offer to stop the turn when the user needs an immediate change. Current explicit direction always outranks saved memory.

### Retrieval boundaries

Defer broad cross-note search. Start with supporting material the user explicitly selects, subject to ownership checks. If search becomes useful later, scope it to authorized notes, mark retrieved material as untrusted context, and do not grant permission to change a note merely because it can be read.

Research tools should support the discussion when a factual uncertainty matters. They should not turn every capture into a long research job. Third-party documents and agent outputs remain untrusted content, not instructions that can change permissions.

## Living alongside other agents

Better Chat does not need to replace the user's coding agents, research tools, or existing chat applications.

Start with portable input and output:

- Paste an excerpt or upload another agent's result.
- Export a note and the specific question the user wants investigated.
- Bring a response back into the conversation with its origin attached.

A later authenticated MCP interface could let compatible agents read a selected note brief and submit material. Access should be scoped to selected notes. External agents should not receive unrestricted notebook access or permission to overwrite documents.

External material enters the same sequential conversation. It does not require concurrent agent execution or an agent orchestration dashboard.

## Dependency and stack reset

No existing package version should be treated as a requirement. Review every retained dependency, resolve current published releases together, and pin the resulting compatible set.

Do not force incompatible versions together merely because each is individually tagged `latest`. Record any exception, especially where Cloudflare packages require a specific AI SDK generation or React binding.

Provisional choices:

| Area | Proposal |
| --- | --- |
| Language and client | TypeScript, React, Vite |
| Navigation | TanStack Router |
| Agent runtime | Cloudflare Agents SDK and Think |
| Model integration | AI SDK version compatible with the selected Cloudflare releases |
| HTTP | Thin Worker entry, with Hono if useful |
| Authentication | Evaluate current Better Auth against Workers |
| Persistence | Durable Object SQLite, D1, R2 |
| Provisioning | Alchemy if current support fits the required resources |
| Verification | Vitest, Workers-runtime tests, Playwright |

The editor, ORM or SQL access layer, formatting tools, and ordinary request library remain open. TanStack Query can manage account or directory requests if useful, but it should not create a second owner for live note state.

A custom provider framework, workflow engine, vector database, or sandbox platform is not a starting requirement. Add tools and infrastructure when a concrete thought-work interaction needs them.

## Reliability, cost, and privacy

Durable execution should survive the user closing the application after server acceptance. Browser reconnection and server execution recovery are separate behaviors and both need testing.

Use stable submission identifiers and idempotent document changes. Recovery must not apply the same rewrite twice. A partial response must not masquerade as a completed revision.

Bound model steps, retries, elapsed execution time, and spend. Per-account limits must account for work across independent notes. BYOK does not remove the application's compute and storage costs.

Show per-turn cost or usage in a small, secondary detail inside the note. Distinguish estimates from settled charges and attribute BYOK use only when the execution record supports it. The initial spending policy remains open, but exhausting a budget must preserve accepted input, conversation, and completed revisions. Stop further billable work with an honest budget status and an explicit way to continue after resolving the limit. Do not promise checkpoint resumption unless the selected runtime supports it.

An ordinary clarifying question ends the agent turn. Persist the question and let the user's eventual answer start a new turn from current note state. Do not keep execution open, impose an answer deadline, or automatically change the note's state merely because the user has not replied.

Only introduce expiry if a later workflow genuinely suspends execution for approval or another external event. Such a wait needs a bounded lifetime, cleanup of any held resources, and protection against a late response restarting an expired turn. Hoplite's approval timeout is not a reason to impose a timeout on ordinary thinking.

Private thought work can contain sensitive material. Keep note content out of routine logs, disclose which providers process it, and support deletion of associated files and runtime records. Do not describe the application as end-to-end encrypted if the server and model providers need to read note content.

External actions such as sending email or modifying third-party accounts are outside the initial scope.

## First implementation experiment

Prove one complete interaction before expanding the agent roster or connector catalog:

1. Capture a messy thought on a phone.
2. Receive a first draft that preserves the user's intent and original capture.
3. Answer a clarifying question and receive a revision.
4. Inspect what the revision added and removed, compare it with the original capture, and undo it.
5. Request a different perspective for the next turn. A discussion-only or challenge turn must not modify the document.
6. Interrupt a mistaken rewrite with a correction. Verify that the replacement turn follows the correction and the cancelled turn cannot apply a late revision.
7. Stop a revision, observe stopping and stopped states, and take over editing without queued input launching unexpectedly.
8. Close and reopen the application after server acceptance.
9. Recover the saved document, conversation, and honest execution status without duplicate work.
10. Leave a clarifying question unanswered, return later, and answer in a new turn without expiry or lost context.

Include text capture first. Add a record-and-upload voice path early enough to test the mobile product premise; real-time voice conversation is a separate decision.

Evaluate fidelity as well as runtime correctness. The agent should not convert uncertainty into certainty, invent preferences, or replace the user's wording with generic prose. Deliberately test ambiguous, contradictory, and emotionally charged captures.

Force context compaction after a correction and check that the rejected interpretation does not return as the user's belief. Confirm a reusable preference, inspect and remove it, and verify that later turns no longer receive it. Check that an exploratory statement creates no global memory. Exercise budget exhaustion and verify that saved work remains available and further billable work stops.

## Open decisions

- Whether the note or conversation occupies the primary mobile view, and how the user switches between them.
- Which perspectives are visible and whether switching them changes instructions, model, or both.
- How often the agent revises automatically versus discussing a possible change first.
- Which editor and document format best support mobile writing and useful exports.
- Voice recording retention, transcription provider, and whether live voice is worth pursuing.
- How users mark a note as settled without implying permanent agreement.
- What evidence would justify adding cross-note search after explicit references prove insufficient.
- Hosted model access, BYOK, and the initial spending policy.
- Whether existing Better Chat conversations need import or read-only access.

These questions should not reopen the settled simplifications without a concrete reason: individual use, sequential turns within a note, Cloudflare-owned persistence, and no initial local-first database.

## Source context

The Cloudflare research available during this discussion inspected commit `c96418d5334e1c0aa1fb1614de8ae0787753b3ff`. The earlier memo records a September 11, 2026 research snapshot. Package registry versions were not refreshed while writing this proposal.

Relevant references:

- [Think documentation](https://github.com/cloudflare/agents/blob/c96418d5334e1c0aa1fb1614de8ae0787753b3ff/packages/think/README.md), including experimental status, context assembly, storage, and turn APIs.
- [Durable submissions](https://github.com/cloudflare/agents/blob/c96418d5334e1c0aa1fb1614de8ae0787753b3ff/packages/think/src/think.ts#L10842-L10950), including persistence and idempotency checks before execution.
- [Agent tools](https://github.com/cloudflare/agents/blob/c96418d5334e1c0aa1fb1614de8ae0787753b3ff/docs/agents/agent-tools.md), relevant only if independent child execution becomes necessary.

Think was experimental in that snapshot. Verify required behavior in the exact published releases selected for implementation, including storage migration and recovery behavior. Source on a repository branch may be newer than its released packages.

The older local memo at `plans/reimagining-better-chat-2026.md` contains broader research. Its delegated-work recommendation is not the current product direction.

The [Hermes and OMP reference](hermes-omp-reference.md) records source-level findings about correction handling, context continuity, and personalization. This proposal adopts notebook-specific behaviors rather than either runtime.

The [Hoplite reference](hoplite-reference.md) records a September 2026 documentation review of the hoplite.sh cloud coding-agent platform. Its vendor-reported behavior informs visible stopping, memory boundaries, revision review, and cost attribution; it does not verify reliability. Its approval-expiry policy applies only as a reference for genuinely suspended execution, not ordinary unanswered questions.

## Resolved decisions (grilling, 2026-09-11)

A grilling session settled the open decisions above. The significant ones are recorded as ADRs 0001 through 0009 in `.agents/docs/adr/`. The remaining calls, recorded here so the list above is not mistaken for still-open:

- Document-primary mobile view with a Document / Discussion segmented control, conversation badge for unanswered agent questions (Q1).
- Exactly one focused question per agent turn, then stop (Q2).
- Any explicit chat instruction authorizes a rewrite; the revision links the authorizing message and carries a one-line agent summary (Q3).
- Word-level inline diff, additions underlined and removals struck through, with a view-as-full-document escape hatch (Q4).
- Bare textarea editor in v1 (Q5).
- Device-level speech-to-text only; no in-app STT pipeline, no audio retention. ADR-0007 supersedes this proposal's record-and-upload step and the ten-step experiment's voice item, which becomes: dictate a capture via the device keyboard and verify the transcript lands as an ordinary text capture. R2 drops out of v1 unless attachments return (see ADR-0009).
- Note states: active, resting, settled. Settled means done for now, never agreed; writing in a settled note makes it active again (Q7).
- BYOK-only model access with a per-account cap on app-side spend in app-controlled units (Q8, ADR-0006).
- No import of existing Better Chat conversations in v1 (Q9).
- Cross-note search revisits only when explicit references demonstrably fail (Q10).
- Derived working brief stored in the Note Agent's DO SQLite, regenerated every turn with a forced regeneration after corrections, linked back to sources, never hand-edited.
- One Memory screen in settings: flat preference list with scope, source link, edit/disable/delete. No suggested memories in v1.
- Default export is the document as Markdown with a small front-matter block; conversation export is a separate explicit action.
- Stale-edit conflicts keep the user's text in a collapsed "your version" block with one-tap copy back; no auto-merge.
- Settings ship with keys, memory, and account only.
- The agent proposes a short title when the first draft completes; user edits win; first words of the capture until then.

Settled simplifications that survived the session: individual use, sequential turns within a note, Cloudflare-owned persistence, online-first thin client, no initial local-first database.
