# Lessons from Hoplite

Research date: September 2026.

This is a source-backed reference for the [agent notebook proposal](notebook-proposal.md), following the method of the [hermes/omp reference](hermes-omp-reference.md). Recommendations here are candidates for that design, not approved implementation changes.

## Summary

Hoplite is a closed-source cloud coding-agent platform (YC S26). You connect GitHub repositories, describe a task, and an agent works it in an isolated cloud sandbox, verifies itself against a live preview of your app, and opens a pull request. It launched on Hacker News on August 3, 2026.

Hoplite is the opposite pole from the notebook hypothesis. Its unit of value is execution capacity: many concurrent agents, each in its own machine, shipping reviewable diffs. The notebook's unit of value is one developing thought. That contrast is the most useful thing about it: it shows what a generic agent platform sells, and therefore what "the user's product" has to mean for us.

After the full documentation pass, four things transfer directly. One message equals one run, with server-side queuing and a durable stop, which is product evidence that our sequential-turn model works under real load. Approvals are a permission boundary enforced at execution time, with an expiry lifecycle that treats a waiting run as billable state. Verification is by rendering, not trust, which suggests the notebook equivalent is revision diffs the user can read, not agent self-assurance. And the full read surfaced a documented personal-memories system whose curation rules are almost a checklist of the hermes lessons: save only explicitly stated stable preferences, never infer from agent output or tool results, and give a running turn an immutable snapshot of memory.

One caveat dominates the method: nothing here is source. Every behavior described below is a vendor claim from Hoplite's own documentation or the founders' launch comments. Where the docs contradict the founders' prose, I say so.

## What the evidence actually is

No public repository for hoplite.sh exists. The GitHub repositories named "hoplite" are unrelated projects (a Kotlin config library, an embedding-search research tool, and others). I searched for source and did not find it.

This reference covers the complete documentation sitemap: all 35 pages listed at `/docs/sitemap.md` (generated September 11, 2026) were read in full, plus the landing page, `llms.txt`, `agents.txt`, the MCP discovery surface, and the launch thread. No page was skipped as irrelevant.

So the evidence base is:

- First-party documentation at `hoplite.sh/docs`, served as markdown with canonical URLs (`/docs/threads.md` and so on), an `llms.txt` index, an `agents.txt` capability description, an OpenAPI specification, and an MCP discovery manifest.
- The [launch thread](https://news.ycombinator.com/item?id=49157997), 81 points, 70 comments, with substantial founder replies.
- The public [pricing page](https://hoplite.sh/pricing) and landing page.

There is no implementation evidence at all. Nothing below establishes that the described behavior is correct, complete, or reliable. Contrast with the hermes/omp review, where tests and source lines carried the claims.

## 1. One message, one run: the sequential-turn model in production

### Source behavior

The docs define a **thread** as one conversation and one task, and a **run** as one agent execution turn started by each user message. Messages sent while a run works stack up in a Queued panel and are applied in order when the current run completes; the user can remove a queued message before it runs. [P1]

Stopping is durable and stateful. `/stop` "durably requests cancellation", and the interface shows a **Stopping** state until the worker finishes terminalization. Messages sent after a stop queue for the next run. Stop is unavailable during sandbox initialization because setup cannot be interrupted. [P2]

`/retry` re-runs from the last checkpoint after a failure or a wrong turn, and a failed thread can always be retried. [P2]

### Application to Better Chat

This is the same model the notebook proposal already commits to: one active agent turn per note, user input admitted by the server, no concurrent writers. Hoplite's docs describe that model as their core primitive, not an experiment. Two details are worth adopting in spirit:

- **Queued input is first-class, not a disabled composer.** Mid-run input is accepted, ordered, and cancellable before it runs. Our proposal discusses correction and stop semantics; this shows queuing as the user-facing answer rather than a hidden third command.
- **Stop is a visible state, not a moment.** Between "stop requested" and "stopped" there is terminalization. The proposal already requires that a stopped turn must not apply a late rewrite; the missing UI detail is showing the user that stopping is in progress and that what happens next (queued or dropped) is a choice.

The initialization exception is also a product answer: some phases of a run are not interruptible, and the product says so instead of pretending. A note capture that is being transcribed or a first draft that is being shaped may deserve the same honest "cannot stop yet" treatment, as long as it is bounded.

## 2. Approvals are enforced at the write, and expire with the run

### Source behavior

Sensitive actions pause for approval in an inline bar: credentials and environment files, CI workflows, infrastructure configuration, unresolved targets, paths outside the workspace, all shell commands, process kills, preview checklist changes, and proposed project-settings changes. Routine reads, searches, and repository-local edits run without interruption. A second check exists inside execution: answers to agent questions are persisted before execution resumes so they survive refresh or worker retry. [P3]

The lifecycle is the sharper lesson. An unanswered approval expires after 72 hours by default. Hoplite then closes that waiting run, releases its billing hold, wakes the session for idle reclaim, and rules that a late approval cannot restart the run and nothing is published by expiry. The user continues the thread with a new message from the current thread state. [P3]

### Application to Better Chat

Two lessons.

First, the shape. Approval-gated actions distinguish "the agent asks before touching" from "the agent reads freely". Our perspectives (discuss, shape, challenge, research) enforce permissions the same way: the tool list changes per turn, and the write interface still checks the active turn and permission at execution. Hoplite's split between "runs without interruption" and "pauses" is a UX calibration we will need for revisions versus discussion.

Second, the lifecycle. A note waiting on the user is not free. If a turn pauses for a question the user never answers, the run must eventually close rather than hold a runtime open indefinitely. "A late answer does not resurrect the old turn; it starts a new turn from current state" is the correct semantic, and Hoplite states it explicitly. Map this to the proposal's turn admission: an unanswered clarifying question ages out, the note rests, and the user's next input starts a fresh turn that still has the full conversation behind it.

The persisted-before-resume detail is directly relevant to our reliability section: user answers to agent questions are input, and input belongs in Cloudflare storage before execution continues, not in a browser tab.

## 3. Verification by rendering, and the diff as the review surface

### Source behavior

The founders' thesis is that developers will "review the product output" rather than the code. The product backs that with mechanics: the agent starts the user's app on a live preview URL inside the thread and checks its own work against it, agents get a persistent Chromium session for UX flows, and Hoplite "prepares video recordings of all new features, out of the box, so you can confirm the agent's output without juggling ports." A checklist attached to previews guides the user's review. [P0] [P4] [P5]

The review surfaces are the activity timeline (tool calls with human-readable descriptions, mid-run reasoning folded in), a changed-files diff tree, and the PR rail with checks and unresolved comments. [P3] [P6]

### Application to Better Chat

The general principle transfers even though the artifacts differ: **the agent's claim is never the review surface. The work itself is.** Hoplite shows the running app; a notebook shows the document. That points at one concrete capability the proposal lacks: revision diffs. When the agent reshapes a draft, the user should see what changed against the previous version, at a glance, before deciding whether to keep it. "Undo an agent rewrite" is already in the first experiment list; a readable diff is what makes undo and accept meaningful instead of a binary gamble.

The video-recording idea has a weaker analog worth one thought: for voice capture, the original recording is the ground truth, and playing it back next to the transcription is the notebook's equivalent of "confirm the output without trusting the agent's summary." The proposal already keeps captures; surfacing them at the moment of doubt is the cheap version of this lesson.

The activity timeline pattern (what the agent did and why, folded for scannability) is a reasonable shape for a note's turn history if turn activity gets verbose, but the notebook proposal deliberately keeps execution status inside the note, so borrow only the "human-readable description per step" habit.

## 4. Money visibility is part of the product

### Source behavior

Hoplite shows a running cost chip per thread, with the split between LLM and sandbox charges, expanding to model, token, runtime, BYOK, and subscription attribution. Per-run attribution lives on the usage page. [P13] A thread has an optional **lifetime spend limit**; when a run reaches it, Hoplite parks the run instead of retrying or failing it, and raising or removing the limit wakes the parked session. [P13] Credits settle honestly: runs reserve credits while in flight, show as **Held**, then release the difference when the run completes. A BYOK badge appears only when a durable model-resolution record exists for the run, so mixed threads stay unbadged and the UI does not overstate who paid. [P13] Small housekeeping models handle thread titles and compaction; automatic compaction normally bills zero credits because a platform-funded model runs it, falling back to the thread's model and normal attribution if that resolver fails. [P14] The free tier is 140 credits per month, 60 per UTC day. [P15]

The founders add a pricing philosophy: no upcharge on tokens or sandbox costs, because an upcharge "would create a monetary incentive" against heavy agent use; they charge seats with included credits instead. [P8] Pricing is $0 free tier (2 projects, 5 concurrent sessions) and $99 per seat per month with $100 of credits. [P0]

### Application to Better Chat

For individual thought work, cost anxiety kills the product faster than cost itself. A user mid-thought should never wonder what the last turn cost. The transferable mechanic is per-turn usage attribution visible in the note, not a dashboard in settings. The proposal already bounds spend per account; Hoplite adds the presentation answer: show the number where the work happens.

The park-not-fail behavior matters as much as the display. [P13] An exhausted budget must not destroy conversation state. It should pause the note with an honest status and a way to continue, the same way a failed thread keeps its checkpoint and stays retryable. And the BYOK badge rule is worth copying as a principle: never badge a run as user-paid without a durable record proving it. UI claims about who paid need evidence, not defaults.

Their no-upcharge stance is also a positioning datum: an agent platform can compete on "we do not profit from your tokens." Our BYOK question in the proposal should be framed the same way, what the platform charges for (persistence, runtime, transcription) versus what passes through (model tokens).

## 5. Portability as an onboarding strategy, with a claim the docs do not back

### Source behavior

`hoplite onboard` imports local session history, personal skills, and optionally MCP server credentials from Claude Code, Codex, or OpenCode. Server addresses import without credentials; credentials import only through an explicit, default-unselected step, are encrypted with AWS KMS, and are decrypted only when a run connects. There is an explicit undo: `hoplite undo` removes what a previous onboard imported. Personal skills apply only to projects the user starts, never to automations. [P8]

The launch post says onboarding ports over "sessions, memories, MCP servers." [P0] The import doc covers sessions, skills, and MCP servers. It does not mention memories, and no other page documents importing them. Hoplite does document a memories system (section 8), so the gap is specifically about import, not about the feature itself. Treat memory portability as a founder claim without documented support.

### Application to Better Chat

Three things.

- **Default to importing structure, not secrets.** Addresses import freely; credentials stay local until the user opts in, and the grant is explicitly restated ("an imported token grants Hoplite's agents the same access it granted your local tools"). The notebook's eventual external-agent interface should copy this posture: selected notes, explicit scope, the grant restated in the UI at the moment of import.
- **Every import is reversible with one command.** For our capture-and-derivative model, that means account deletion and export must cover original captures, not just derived documents. The proposal already requires this; Hoplite shows a competitor treating reversibility as a marketing feature.
- **The open question from the proposal, "whether existing Better Chat conversations need import," has a template here.** A one-command import of old conversations, marked as history rather than as notes, is a credible onboarding path if it turns out to matter.

## 6. The product is built to be read by agents

### Source behavior

Every docs page serves markdown with a canonical `.md` URL. The site publishes `llms.txt`, `agents.txt` (a capability statement with an MCP endpoint and OAuth discovery), an OpenAPI specification, and a machine-readable MCP discovery manifest. The `agents.txt` text says what Hoplite is for and when to use it. [P9] [P10]

### Application to Better Chat

This is a distribution lesson. If the notebook ever exposes an authenticated MCP interface (the proposal lists it as a later addition), the surrounding scaffolding matters as much as the endpoint: a capability statement that says what the product is for, discovery manifests, and per-page markdown. It also matters sooner in a smaller way: our export formats should be as legible to other agents as to humans, since "bring a response back into the conversation with its origin attached" is already in the proposal.

## 7. What the launch thread admits, and what it warns about

The founder comments are unusually candid, and two admissions matter for us.

**The custom harness is a bet they might lose.** Asked about differentiation, the founder listed UX, cost, and harness performance, said they "can certainly win at the first, are at parity with the second, and likely struggle at the third," and continued: "if those go poorly then we'll transition from the custom harness to using the first party Claude Code/Codex. So quite fixable." [P10] A YC company with a custom harness has a written fallback to a maintained runtime. That supports the notebook proposal's decision to build on Cloudflare Agents SDK and Think rather than a custom loop.

**Their differentiation is execution capacity, which we do not need.** "Scale to infinity," hundreds of concurrent sandboxes, fan out a backlog. The infra follows: Modal sandboxes, Temporal durable workflows, Planetscale, AWS. [P0] A notebook has exactly one active turn per note. The proposal's per-note Durable Object on Cloudflare is the right-sized version of the same requirement. Nothing in Hoplite suggests we need Modal-class infrastructure; their concurrency is the feature we deliberately rejected.

The pushback in the thread also carries a warning we should keep: several commenters argued that porting arbitrary dev environments into ephemeral sandboxes is a tarpit, that micro-VMs break down on real codebases with dependent services, and that pricing ($99/seat) is steep for individuals. [P11] The transferable caution for us: pick a domain where the environment is small and owned by the product. A note is text, audio, and attachments. There is no dev environment to port, which is precisely why the notebook shape avoids this class of trap.

Two smaller signals worth recording. Commenters called the landing page "Claude slop" and the founders conceded and committed to a redesign; AI-styled presentation is now a trust negative in exactly this audience. And the founders' pitch that "developers will review product output, not code" drew the strongest engagement of anything in the thread, which suggests the framing resonates even with skeptics.

## 8. Personal memories: curation rules, not inference

### Source behavior

The full read found a documented memories system under Settings → Agent personalization → Agent memories. Users review, create, edit, and delete durable personal memories. Agents you start receive them; unattended automation runs without an initiating user do not inherit anyone's private context. [P16]

The curation rules are the striking part. The agent can save or update a concise, stable, cross-thread preference without per-write approval. After a successful run, Hoplite may curate an explicitly stated stable preference from your opening message. It does not infer preferences from agent output, tool results, repository content, or external data, and it rejects secrets, credentials, sensitive personal data, raw conversation text, repository or project facts, commands, branches, tickets, and temporary task state. [P12]

Memory changes apply to later runs. A run already in progress keeps the immutable memory snapshot it started with, even if the user edits or deletes memories mid-run. [P12] A separate per-user Agent personalization page sets verbosity and code-comment style, enforced for every run the user starts; automatic continuations such as PR autofix keep the output preferences of the thread owner whose work they continue. [P12]

### Application to Better Chat

This is the hermes lesson (learn methods separately from facts about the user) shipped as documented product policy, and it answers several open questions in our proposal at once:

- **"Do not infer permanent personal facts from exploratory notes"** is not just our proposal's instinct; a commercial platform documents it as an explicit non-behavior with a rejection list. Our memory design should name its own rejection list. Reasonable candidates for ours: tentative thoughts, anything still under discussion in a note, note-local direction, and anything the user said while exploring a possibility.
- **Curate only from the user's own words, and only stable preferences.** "When I am exploring an idea, ask one question at a time" qualifies. "Maybe I should stop managing people" never does. Hoplite draws exactly this line by sourcing only from explicitly stated preferences and never from agent output or tool results.
- **The immutable per-run snapshot** is a better rule than re-reading memory mid-turn. It gives a turn a stable self-view, prevents a mid-conversation memory edit from changing an answer the user already trusted, and simplifies testing. It also matches the hermes frozen-snapshot pattern.
- **Scoping follows authorship.** Memories apply only to agents the user personally starts. If the notebook ever gains scheduled or external-agent runs, they should not inherit a private profile that was built for conversation.

Worth naming what we would adapt: Hoplite saves memories without per-write approval, which fits coding chores. Thought work is slower and more personal, so the proposal's current instinct (offer to remember, let the user confirm, inspect and edit the record) remains the right default even though a platform ships the more automated version.

## 9. History is scoped, bounded, and marked untrusted

### Source behavior

Repository agents get `list_threads`, `search_threads`, `get_thread`, `read_thread_messages`, and `read_thread_message`, fixed to the signed project scope. An agent cannot request organization scope, another project, or a cross-project thread ID. Retrieved thread titles, excerpts, and messages are treated as untrusted historical context rather than instructions. Continuation is narrower: `send_message_to_thread` targets threads in the same project created by the invoking user, cannot target the current thread, and cannot recursively bounce work between threads. [P16] [P17]

The manage page adds housekeeping rules. Thread titles are generated automatically, capped at 12 words and 100 characters, with attachments and incidental actions treated as evidence rather than the subject; the agent can correct a materially vague or outdated title but does not churn an accurate one, and never replaces the user's explicit `/rename`. Status transitions among active states display only after remaining stable for five seconds, so brief backend handoffs do not bounce rows between groups. Automation-started threads are hidden from the thread list by default so unattended runs do not crowd out work started by people. Transcript export includes the title, timestamps, and safe user and assistant messages, and excludes private execution context, system and tool messages, and tool inputs. [P18]

### Application to Better Chat

This is the direct input for the proposal's open cross-note retrieval decision, and it lands on the conservative side:

- Scope retrieval by authorship and explicit linkage first. Hoplite allows project-wide search but only inside one signed scope, marks everything retrieved as untrusted reference, and keeps continuation (writing) strictly narrower than reading. A notebook starting cross-note search should copy all three properties: one scope, untrusted marking, write access narrower than read.
- Generated metadata never overwrites user intent. The agent may fix a materially wrong note title but must never churn an accurate one or override an explicit user rename. Our auto-titling (inherited from Better Chat's conversation titles) deserves the same policy, including the cap.
- The inbox should hide or demote anything not started by the user, for the same reason Hoplite hides automation threads and the hermes search demotes cron sessions: generated activity crowds out human work.
- Export is curated, not raw. Transcript export leaves out tool messages and private execution context. Our exports should distinguish the user's words from generated text the same way, which also serves the privacy section's rule that routine logs keep note content out.

The five-second status-stability delay is a small but transferable UI habit for our inbox: note-state rows should not flicker between states during turn handoffs.

## Where Hoplite and the notebook deliberately diverge

| Hoplite | Notebook proposal | Why we keep ours |
| --- | --- | --- |
| Hundreds of concurrent sandboxes | One active turn per note | Individual thought work, not throughput |
| The PR/diff is the output | The note's current document is the artifact | The user's own expression, not a change to a repo |
| Team workspaces, seats, per-seat pricing | Individual product | Different buyer, different price point, no seats |
| Execution status surfaces everywhere (statuses, docks, subagent panels) | Execution status lives inside the note | The inbox helps the user choose what to think about, not what to supervise |
| Approval gates on a third party's repo | Perspective permissions inside the user's own note | The trust problem is smaller; the ownership problem is the point |

The comparison sharpens the open decision at the end of the proposal. Hoplite's answer to "why this product and not another agent platform" is execution capacity and onboarding polish. That answer is unavailable to us by choice. The notebook's answer has to live in the artifact: the note that holds the user's idea, their original words, and the record of how it developed. Hoplite has no equivalent surface; its thread is scaffolding around the PR.

Hoplite's own guidance states the gap from their side. The delegate page tells users to keep unshaped work out of the product: "Tasks you can't define done for yet. If you'd struggle to tell a colleague when to stop, the agent will struggle too. Explore locally until the task has a shape, then delegate the shaped version." [P5] A thread is sized to one pull request. The notebook is exactly the space Hoplite routes around: the pre-shape stage where the user does not yet know what done means. That is the cleanest statement in all of this research of why the two products do not compete.

## Recommended additions to the proposal

| Priority | Addition | First useful scope |
| --- | --- | --- |
| First | Explicit memory curation rules with a rejection list and per-run snapshots | Save only user-stated stable preferences; never infer from agent output or tentative thoughts |
| First | Visible stopping state with queued-or-dropped choice after stop | Stop a revision mid-turn, see stopping, decide what happens to pending input |
| First | Turn-level unanswered-question expiry | A note waiting on a user answer ages out and rests instead of holding a runtime |
| First | Revision diff as the review surface | Show what an agent rewrite changed before the user accepts it |
| Next | Per-turn cost attribution shown in the note, with park-not-fail on budget exhaustion | A small usage line per turn; a spent-out note pauses with an honest status |
| Next | Scoped cross-note search, marked untrusted, write narrower than read | Only if the cross-note retrieval open decision resolves toward search |
| Next | Generated-metadata policy for titles: correct vague, never churn, user rename wins | Auto-titling notes from captures |
| Next | One-command, reversible import of existing Better Chat conversations | Import as history, not as notes |
| Later | Agent-readable product surface (capability doc, markdown URLs) | If and when the authenticated MCP interface is built |

Nothing in Hoplite challenges the settled simplifications: individual use, sequential turns, Cloudflare-owned persistence, no local-first database. It is the strongest confirmation yet of two of them.

No changes to `notebook-proposal.md` were made as part of this research beyond adding this document to its source references.

## Source record

No source pins are possible; Hoplite is closed-source. All links are first-party pages or the launch thread, retrieved September 2026. Everything cited below is vendor-reported; treat implementation claims as unverified.

- P0. [Landing page](https://hoplite.sh/), product narrative, four-step onboarding, use cases, security claims, pricing tiers and FAQ.
- P1. [Threads](https://hoplite.sh/docs/threads), thread/run/sandbox/PR model, queued messages, PR rail.
- P2. [Run a thread](https://hoplite.sh/docs/threads/run), queued panel, `/stop` durable cancellation and Stopping state, initialization exception, `/retry` checkpoints, attachments, `/compact` and automatic compaction retry.
- P3. [Review and approve work](https://hoplite.sh/docs/threads/review), approvals table, 72-hour expiry and run closure, persisted question answers, subagents, activity timeline, inline references, response ratings.
- P4. [Make your repo agent-ready](https://hoplite.sh/docs/agent-ready), setup/run/check/diagnostics scripts, project instructions, skills on demand, agent-driven configuration bootstrap.
- P5. [What to delegate](https://hoplite.sh/docs/delegate), task sizing guidance for delegated work.
- P6. [Import from another tool](https://hoplite.sh/docs/import), `hoplite onboard`, skills and MCP import, credential opt-in and KMS encryption, `hoplite undo`, personal-skill scoping. No documented memory import.
- P7. [Agent capabilities](https://hoplite.sh/agents.txt), MCP endpoint, OAuth 2.1, scoped access statement.
- P8. [Launch HN thread](https://news.ycombinator.com/item?id=49157997), founders on infra (AWS, Temporal, Modal, Planetscale), custom harness rationale, onboarding claims including "memories", preview and video-recording features, pricing philosophy (comment 49158755), no-upcharge stance, QA-flow optimization (comment 49160592).
- P9. [llms.txt](https://hoplite.sh/llms.txt), agent access index and "when to use Hoplite" guidance.
- P10. Founder harness-honesty comment (49165702): differentiator ranking, harness performance doubt, fallback to first-party harnesses, P95 setup-time target, ideal customer profile.
- P11. Community criticism (49165702 thread, 49160584, 49161018, 49166404): dev-environment porting as tarpit, ephemeral VMs vs real codebases, pricing pushback, enterprise incompatibility.
- P12. [The agent](https://hoplite.sh/docs/agent), run loop, web-research trust rules, self-verification policy, personalization, personal memories, self-configuration, `report_platform_issue`.
- P13. [Track cost](https://hoplite.sh/docs/threads/cost), cost card, lifetime spend limit and parked runs, credit holds and settlement, BYOK badge rules, per-run attribution.
- P14. [Models and speed](https://hoplite.sh/docs/agent/models), model lineup, reasoning effort, subscription routing (ChatGPT, Claude Code tokens), BYOK routing, housekeeping models.
- P15. [Billing](https://hoplite.sh/docs/workspace/billing), prepaid credits, free-tier limits (140/month, 60/day), held credits, metering per provider, usage limits, expired-access behavior (data stays browsable, billable work blocked), platform-funded compaction.
- P16. [Security and data handling](https://hoplite.sh/docs/workspace/security), credential brokering, MCP credential encryption model, fork quarantine, handoff upload scope (user/assistant only), cross-thread search scoping and untrusted marking, web_search trust boundary.
- P17. [Tools and permissions](https://hoplite.sh/docs/agent/tools), full tool catalog, approval-gated list, thread context tools, `send_message_to_thread` restrictions, source-control lease design.
- P18. [Manage threads](https://hoplite.sh/docs/threads/manage), status model with five-second transition stability, thread-list grouping, automation-thread hiding, title generation policy, transcript export contents, organization history search.
- P19. [Preview your app](https://hoplite.sh/docs/sandboxes/previews) and [Sandboxes](https://hoplite.sh/docs/sandboxes), durable shared preview URLs with server-attached credentials, preview states, durable product state versus replaceable runtime, snapshot recovery with explicit data-loss warning.
- P20. [Write effective instructions](https://hoplite.sh/docs/prompting) and [Prompt templates](https://hoplite.sh/docs/prompt-templates), goal/constraints/verification anatomy, correction-through-denial as steering.

## Documentation drift noticed

The launch post claims onboarding ports "memories" along with sessions and MCP servers. The import documentation covers sessions, skills, and MCP credentials and never mentions memories, and no other page documents importing them. A memories system does exist (section 8), so the gap is narrow: memory *import* is a founder claim without documented support.

The landing page's FAQ describes free-tier limits as "very generous" without numbers. The billing page documents the actual numbers: 140 credits per month, 60 per UTC day, card setup required at Free enrollment. The free tier is smaller than the landing page implies.

Two engineering facts deserve the same skepticism the founder claims get, since they are also vendor-reported: the per-secret KMS encryption model with auditable decryption, and the brokered-token boundary that keeps GitHub credentials out of the sandbox. Both are plausible and internally consistent across pages, but nothing here verifies them.