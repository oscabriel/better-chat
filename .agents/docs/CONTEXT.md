# Better Chat

Glossary for the agent-notebook product: an agent harness for deep thought. Deep thought is what precedes knowledge work, research, and coding: figuring out what the right thing to work on is. One context. Implementation details live in `.agents/research/notebook-proposal.md` and the ADRs beside this file.

## Language

**Deep thought**:
The thinking that decides what is worth working on, before any knowledge work, research, or coding begins. The object of this product; everything downstream of it is out of scope.
_Avoid_: knowledge work, research (as the product's purpose), productivity

## Records

**Note**:
The durable home for one developing idea, question, or decision.
_Avoid_: chat, thread, doc (for the whole note)

**Capture**:
The user's original input that starts a note, always text, typically dictated on the device.
_Avoid_: recording, memo

**Document**:
The current editable expression of a note. A note has exactly one.
_Avoid_: note content, body

**Draft**:
The first document an agent shapes from a capture.
_Avoid_: first version

**Conversation**:
The exchanges through which the user develops the note.
_Avoid_: chat, thread

**Revision**:
A saved document version with its author, time, and reason for change.
_Avoid_: edit, checkpoint, version history

**Turn**:
One admitted agent response, including any revision it was authorized to make.
_Avoid_: run, reply

**Perspective**:
The instructions and optional model behind a turn. Switching one changes behavior and permissions, not just a name.
_Avoid_: persona, character, agent (when meaning perspective)

**Working brief**:
A derived, non-authoritative record of a note's unresolved questions and rejected interpretations, rebuilt from source exchanges.
_Avoid_: memory, summary (as authority)

**Preference**:
A stable, user-confirmed instruction reused across notes, with a scope and a source reference. Tentative note content never becomes one.
_Avoid_: memory (inferred), profile, persona

## States and interactions

**Active / Resting / Settled**:
The three note states. Settled means done for now, never agreed with. Writing in a settled note makes it active again.
_Avoid_: archived (deferred), closed, done

**Inbox**:
The entry list of notes a user might think about next.
_Avoid_: dashboard, feed

**Correction**:
User input that rejects the current interpretation; it interrupts the running turn rather than queueing behind it.
_Avoid_: feedback, complaint

**Rewrite**:
A document change a user explicitly authorizes, producing a revision.
_Avoid_: auto-edit, sync

**Take over**:
The user resuming direct editing after a stopped turn, guaranteed free of that turn's late writes.
_Avoid_: handoff, reclaim
