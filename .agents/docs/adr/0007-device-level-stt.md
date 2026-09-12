---
status: accepted
date: 2026-09-11
---

# Speech-to-text stays at the device level

The app never uploads, stores, transcribes, or retains audio. Captures are dictated with whatever the device provides (system keyboard dictation, or a tool like superwhisper the user configures independently, including whatever key that tool needs) and reach the app as ordinary text. This deliberately supersedes the notebook proposal's record-and-upload voice step and removes R2 audio storage from v1. Rationale: an in-app STT pipeline adds a provider relationship, retention obligations, and cost accounting for a capability every phone already has.
