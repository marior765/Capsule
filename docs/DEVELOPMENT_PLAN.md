# Development Plan

## Feature Sets

### Set 1 — Competitive baseline (table stakes)

**AI chat core:**
- [ ] On-device LLM inference via llama.rn (GGUF models, GPU offloading)
- [ ] Streaming responses with token-by-token display
- [ ] Markdown rendering + syntax-highlighted code blocks with copy buttons
- [ ] Conversation list with local search
- [ ] Model download from Hugging Face (user-initiated, the one allowed network action)
- [ ] Model management: list downloaded models, delete, select active model
- [ ] Hardware-aware model recommendations (detect available RAM, suggest model size + quantization)
- [ ] Exposed sampling params: temperature, top-p, top-k, repeat penalty, context length, seed
- [ ] Custom system prompts saved as reusable personas/assistants
- [ ] Visible context-window usage and token/sec stats during inference

**Data core (capsules):**
- [ ] Capsule CRUD with local persistence
- [ ] Custom field types: text, long-text, number, boolean, date/time, single-select, multi-select, relation, attachment
- [ ] Capsule types / templates (define schema once, reuse it)
- [ ] List view + detail view for capsules
- [ ] Search across capsules (local full-text)
- [ ] Filter & sort by field
- [ ] Tags / collections for organization
- [ ] Field validation (required, type, range)

**App-wide:**
- [ ] Settings screen (storage, appearance, AI, privacy)
- [ ] Light/dark theming (via unistyles)
- [ ] Manual import/export of conversations and capsules

### Set 2 — Differentiators (where we win)

**Privacy:**
- [ ] **Encrypted-at-rest storage** — SQLCipher via expo-sqlite, key in expo-secure-store / Keychain. Flagship feature.
- [ ] **Verifiable privacy** — live egress indicator + audit log of data-access/export/network events.
- [ ] **App lock** — biometric / passphrase gate on launch and resume.
- [ ] **Instant full wipe** — one action to securely erase all local data.
- [ ] **Ephemeral chats** — session-only, never written to disk.

**Portability:**
- [ ] **Open portable format** — versioned JSON spec for conversations and capsules. Zero lock-in.
- [ ] **Conversation branching** — edit a message → fork new path, full tree preserved.

**Voice:**
- [ ] **Local voice input** — on-device STT via whisper.rn. Works in airplane mode.
- [ ] **Local TTS** — OS-level Speech API as baseline, local neural TTS later.

**AI + data:**
- [ ] **Chat with your capsules (local RAG)** — local embeddings + retrieval, entirely on-device.

**Sync:**
- [ ] **Serverless LAN sync (CRDT-based)** — direct device-to-device, E2E encrypted, no server. *(Deferred.)*

### Set 3 — Expected / polish

**AI:** Multiple backend support (local default, optional cloud APIs behind consent gate) · Prompt/snippet library · Chat sharing · Image/vision input · Import from ChatGPT / Claude exports

**Data:** Capsule linking · Capsule nesting · Local attachments · Local backup/restore · Import from CSV/JSON/Markdown · Quick capture · Multiple views (list/card/board) · Version history · Bulk operations · Local reminders

**App-wide:** Pinning/favorites · Onboarding flow · Accessibility · Command palette

---

## Phased Roadmap

Each phase is shippable on its own. AI core and local-first foundation ship first.

> **Recommended launch wedge: Phases 0–5.** Delivers a fully functional, visibly-more-private offline AI chat app with voice, encryption, app lock, wipe, branching, and portable data — before tackling the capsule data layer or the hardest items (RAG, sync).

### Phase 0 — Foundation
- [x] 0.1 FSD folder scaffolding + layer-import lint rule
- [x] 0.2 `shared/db` — SQLite client + migration runner
- [x] 0.3 `shared/storage` — MMKV settings wrapper
- [x] 0.4 `shared/ui` — baseline kit + unistyles theme (light/dark)
- [x] 0.5 `shared/llm` — llama.rn wrapper (init, load, complete, abort, model info)
- [x] 0.6 `shared/config` — feature flags, constants
- [x] 0.7 expo-router shell (`_layout`, tabs/stack) + empty routes
- [x] 0.8 llama.rn Expo plugin config (app.json / app.config.js)
- [x] 0.9 `shared/testing` — `buildTestID`, `createComponentTestIDs`, `extendIDs`, `getInputTestId` utilities (required before any widget)

### Phase 1 — AI chat core ← start here
- [x] 1.1 `entities/model` — model metadata schema + CRUD
- [x] 1.2 `features/manage-models` — download GGUF from HuggingFace, list, delete, select
- [x] 1.3 `ModelPicker` widget with hardware-aware recommendations
- [x] 1.4 `entities/conversation` + `entities/message` — models + CRUD
- [x] 1.5 `features/send-message` — compose → stream LLM completion → persist
- [x] 1.6 `ChatThread` + `ChatBubble` + `ChatInput` (plain text; markdown deferred → 1.6.1)
- [x] 1.6.1 `ChatBubble` markdown rendering + code blocks + copy
- [x] 1.7 `InferenceStats` — token/sec + context usage display
- [x] 1.8 `features/manage-conversations` — create, rename, delete, search
- [x] 1.9 chat routes: `chat/index`, `chat/new`, `chat/[id]`
- [x] 1.10 models route: `models/index`
- [x] 1.11 Onboarding flow: welcome → download first model → first chat

### Phase 2 — AI configurability
- [x] 2.1 `features/configure-inference` — temperature, top-p/k, repeat penalty, context length, seed
- [x] 2.2 Settings → inference screen (+ settings hub — every settings screen was unreachable)
- [x] 2.3 Custom system prompts / personas — create, edit, delete, select per conversation (`entities/persona` + `selectPersona`; UI in 2.4)
- [x] 2.4 `PersonaSelector` widget + personas route (+ `chat/new` is now a picker; branch nav + ephemeral route wired)
- [x] 2.7 Prompt templating — `buildMessages` emits structured chat turns and `runCompletion` passes them to llama.rn with `jinja: true`, so each GGUF's own embedded chat template renders the prompt. We write no prompt markup ourselves; the wrapper stays model-agnostic.
- [x] 2.5 `features/branch-conversation` — edit message → fork generation path, preserve tree (data layer; UI in 2.2/2.4 batch)
- [x] 2.6 Ephemeral chats (session-only, never written to disk) — `sendEphemeralMessage` takes no db handle; UI wiring pending

### Phase 3 — Voice
- [ ] 3.1 `shared/stt` — whisper.rn wrapper (init, record, transcribe, abort)
- [x] 3.2 whisper.rn Expo plugin config (no plugin needed — confirmed via `expo prebuild`: `ios/Podfile.lock` shows `whisper-rn (0.6.0)` correctly linked; Android's command-based autolinking has no static per-package evidence to check but errored on nothing)
- [ ] 3.3 `features/voice-input` — hold-to-record → transcribe → insert into ChatInput
- [ ] 3.3.1 First-run download of a single default STT model (e.g. `ggml-base.en.bin`, via CLAUDE.md's one allowed network action — never bundled in the binary) + a minimal `SttProvider` (no multi-model selection UI) so 3.3's route-level wiring becomes buildable. Chosen 2026-08-16 over full STT model management for now — see 9.5 (Phase 9, future releases).
- [x] 3.4 `VoiceRecordButton` widget
- [ ] 3.5 Local TTS for assistant responses (OS-level Speech API as baseline)

### Phase 4 — Privacy core ← key differentiators
- [ ] 4.1 `features/encrypt-vault` — at-rest encryption (SQLCipher) + key in secure store
- [ ] 4.2 `features/app-lock` — biometric / passphrase gate on launch & resume
- [x] 4.3 `entities/audit` + `PrivacyBanner` egress indicator + `EgressLog` viewer
- [ ] 4.4 Settings → privacy screen
- [ ] 4.5 `features/wipe-data` — secure full wipe (models, chats, capsules, settings)
- [ ] 4.6 App lock at launch — done in code: with the lock on, Capsule opens to a lock screen (passphrase, or Face ID / fingerprint) and nothing touches your data until you unlock; everything on the device is encrypted in a separate file; it locks again after you've been away (Privacy setting: immediately / 1 min / 5 min, default 1 min); "Turn off app lock" decrypts without losing data; lock changes are logged as "App lock changed". Needs a simulator/device check before ticking (see BLOCKED.md)
- [x] 4.7 One "erase everything" — Privacy → Wipe all data and the lock screen's "Forgot your passphrase?" run the same cleanup: reminders, every file folder (attachments, chat images, models, picker copies), both database files, settings, then the app-lock keys last (a failed erase leaves the lock on and can be retried); the app restarts afterwards (decided 2026-10-11)

### Phase 5 — Portability ← key differentiator
- [x] 5.1 `shared/format` — versioned portable format spec + serializers
- [x] 5.2 `features/import-export` (single conversation, single capsule, whole vault) — conversations + whole conversation vault, and capsules (single + whole collection, self-contained with type schema, values, tags, versions, reminders, internal links). Embeddings and attachments excluded; personas/snippets are not part of any portable scope yet (see BLOCKED.md)
- [x] 5.3 `features/backup-restore` — conversations scope done; capsules N/A (Phase 6 unbuilt), settings not yet covered
- [x] 5.4 Migration importers (ChatGPT export, Claude export, CSV, JSON, Markdown) — ChatGPT + Claude export into conversations (both unverified against real export files, see BLOCKED.md; parent cycles broken on import), CSV / JSON / Markdown into capsules (rows → new type + capsules, notes → "Note" capsules)
- [x] 5.5 Files in exports — Settings → Import & Export: "Back up everything" makes one zip with every conversation (incl. chat images) and capsule (incl. attachments), restore replaces everything safely (staged, all-or-nothing); capsules export/import as a zip with their files; plus conversations JSON and imports from ChatGPT, Claude, CSV, JSON records and Markdown. Via fflate; files leave only through the system share sheet (decided 2026-10-11)
- [x] 5.6 Personas and snippets in full backup/restore — included in "Back up everything" and replaced on restore; an older backup without them leaves yours untouched (decided 2026-10-11)

### Phase 6 — Capsule data core
- [x] 6.1 `entities/capsule`, `entities/field`, `entities/capsule-type` — models + CRUD
- [x] 6.2 `CapsuleEditor` + `FieldRenderer` for base field types
- [x] 6.3 `CapsuleList` + `CapsuleCard`, capsules routes
- [x] 6.4 Create / edit / delete capsule flows
- [x] 6.5 Search, filter, sort
- [x] 6.6 Tags / collections
- [x] 6.7 `SchemaBuilder` + manage-schema feature
- [ ] 6.8 Relation + attachment field types — relation done (RelationPicker, wired into capsule detail); attachment done in code (file/photo pickers via shared/picker, files copied into app storage, AttachmentList on the capsule screen, deleted with the capsule and on wipe) — needs a device check before ticking (see BLOCKED.md); opening files is 6.9
- [ ] 6.9 Open non-image attachments via the system share sheet — done in code: on a capsule, tap an attachment's name or thumbnail to open it in another app (Open in…, Save to Files); logged in the activity log. Needs a device check before ticking (see BLOCKED.md) (decided 2026-10-11)
- [x] 6.9 `entities/link` with graceful missing-target handling
- [x] 6.10 Field validation

### Phase 7 — AI × data (hard)
- [ ] 7.1 Spike: local embedding model via llama.rn (or separate small model) — wrapper implemented and tested against mocked natives (`initEmbeddingContext`/`embedText`); real device verification of embedding quality, and the llama.rn-vs-dedicated-model decision, queued in BLOCKED.md
- [ ] 7.2 `features/capsule-rag` — index capsules into local vector store, retrieval at query time — done in code: mechanism, dedicated embedding model (BGE small en v1.5) with a user-initiated download on the Models screen ("Capsule search"), app-level `EmbeddingProvider` re-indexing capsules on create/edit/restore and backfilling on start; needs a device check before ticking (model URL, pooling, retrieval quality — see BLOCKED.md)
- [ ] 7.3 "Chat with your capsules" mode — toggle in chat that grounds responses in the user's data — done in code: "Capsules: on/off" switch in chat (remembered per conversation), new and edited messages grounded in the most relevant capsules (sent to the local model only, never stored), an honest notice of what was used; needs a device check before ticking (see BLOCKED.md)
- [ ] 7.4 RAG context shown transparently (which capsules were referenced) — done in code: each grounded answer stores and shows "From your capsules: …" (tap to open; a capsule that's gone shows its remembered title, "not on this device"); kept through delete, export/import, backup; needs a device check before ticking (see BLOCKED.md)

### Phase 8 — Polish & depth
- [ ] 8.1 Multiple backends toggle (optional cloud APIs behind consent gate)
- [x] 8.2 Prompt/snippet library
- [x] 8.3 Chat export as markdown — wired into chat/[id].tsx (persisted chat); chat/ephemeral.tsx has no persisted Conversation entity to export at all, so it's out of scope, not deferred
- [ ] 8.4 Image/vision input (multimodal models) — done in code: a recommended small vision model (SmolVLM 500M) downloads with its projector and loads as vision-capable; with it active, chat offers an "Image" button, the photo is stored with the message and shown in the bubble, and images are sent to the model only while a vision-capable model is loaded; needs a device check before ticking (see BLOCKED.md)
- [x] 8.5 Capsule nesting + version history + bulk operations — all three complete end-to-end: capsule detail screen shows parent picker + children list + history/restore; capsules list has a multi-select mode with confirmation-gated bulk delete (scoped to delete only — bulk tag/reparent are natural low-cost future extensions of the same runBulkOperation mechanism)
- [x] 8.6 Quick capture + command palette — quick capture (capsules list Capture toggle) + command palette (Home's search trigger → one input filtering navigation shortcuts and live capsule search) both complete
- [x] 8.7 Multiple capsule views (card / board) — card (2-column grid) and board (kanban columns grouped by a type's first single_select field, requires an active type filter) both complete; board is read-only this round, moving a capsule between columns means editing its field directly
- [ ] 8.8 Local reminders (on-device notifications) — done in code: on a capsule's screen you set a reminder from quick choices (in 1 hour, this evening, tomorrow 9am, in a week) or cancel one; it schedules a local OS notification (expo-notifications; permission asked on the first reminder; nothing leaves the device), and a reminder saved while notifications are off says "Not scheduled"; reminders are cancelled on capsule delete and the full wipe. Tapping a notification doesn't open the capsule yet. Needs a device check before ticking (see BLOCKED.md)
- [x] 8.9 Accessibility pass — real accessibilityLabel on symbol-only controls, accessibilityRole/State on toggles/buttons matching real state, accessibilityLiveRegion on dynamic errors/confirmations, across the whole app in three beats: Capsules domain (12 widgets + 7 capsules/types routes), Chat domain (6 widgets + 6 routes), Settings/Home/CommandPalette domain (4 widgets + 3 routes; remaining routes/widgets confirmed to have no interactive elements of their own). Focus order and dynamic type support are explicitly out of scope for all three beats — not covered by this box
- [x] 8.10 testID retrofit for every `src/app/` route via `createComponentTestIDs` (CLAUDE.md hard rule; decided 2026-10-09) — every interactive element in every route takes its testID from the route's `testIDs` object, and a static scan test (`shared/testing/__tests__/routeTestIDs.test.ts`) fails the suite if a route ever ships one without
- [ ] 8.11 Reminders: "Pick date & time…" + tap opens the capsule — done in code: next to the quick choices, "Pick date & time…" opens the system picker (iPhone: one sheet; Android: date, then time); tapping a reminder notification opens its capsule, after unlock if app lock is on. Needs a device check before ticking (see BLOCKED.md) (decided 2026-10-11)
- [x] 8.12 Follow-ups — chat can't send twice while a reply is coming; "notifications are off" shows as a notice, not an error; the voice-model download uses shared/fs (relative path, safe re-downloads, shown as network activity) (decided 2026-10-11)

### Phase 10 — Simulator QA fixes (found 2026-10-12, iPhone 17 Pro simulator)
- [ ] 10.1 Voice input: set the audio mode before recording so the mic doesn't throw "Recording not allowed on iOS"; show a plain-language error instead of the raw native exception; a short tap on the mic hints "hold to talk"
- [x] 10.2 Capsule edit: an invalid field value (e.g. date `2026-13-45`) shows an inline error and keeps the user on the edit screen with their input intact — never a silent no-save
- [x] 10.3 Capsule edit: saving returns to the existing capsule screen instead of pushing a duplicate one
- [x] 10.4 Command palette: input sits below the status bar/Dynamic Island, is focused on open and typeable, and the palette has a visible close control
- [x] 10.5 Models, Personas, Snippets, capsule types list and new-type screens get a proper header with a back button (no content under the status bar)
- [x] 10.6 Taps aren't swallowed while the keyboard is up (`keyboardShouldPersistTaps="handled"` on every scrolling form)
- [x] 10.7 Chat composer: the message box takes the remaining width (no letter-by-letter wrapping), stays stable when side labels change, and Send looks disabled when empty
- [x] 10.8 Reminder date picker: Cancel / Set reminder never overlap the time row; sheet respects the bottom safe area
- [x] 10.9 Human screen titles everywhere — no raw route names ("index", "[id]", "[id]/edit", "new", "ephemeral", "inference", "privacy", "import-export") in headers or back buttons
- [x] 10.10 Real tab-bar icons (SF Symbols on iOS) instead of placeholder triangles
- [ ] 10.11 Home: title clears the status bar; shows recent capsules and conversations instead of an empty screen
- [ ] 10.12 Navigation: creating a type from the Capsules empty state returns to Capsules; Capsule types reachable from Settings; a visible "New capsule" button on the Capsules tab
- [ ] 10.13 App display name is "Capsule" (not "capsule") in system prompts
- [ ] 10.14 Chat opens scrolled to the newest message and follows new replies
- [ ] 10.15 Conversations get an automatic title from the first message instead of staying "New chat"
- [ ] 10.16 Context counter ("ctx") reflects the conversation's real token usage and is labelled clearly
- [ ] 10.17 Long-press on an assistant message offers Copy (and Regenerate on the last reply)
- [ ] 10.18 "Capsules: on" can't be switched on while the capsule-search model is missing; the notice never covers the last message
- [ ] 10.19 Chat "Export" is labelled for what it does (copy as Markdown), shows a lasting confirmation, and writes to the activity log
- [ ] 10.20 Choose a persona in chat; personas can be edited, not only deleted
- [ ] 10.21 Capsule type form: duplicate field names are rejected with a message; the per-field toggle has a visible label and aligned layout
- [ ] 10.22 Date fields use a date picker instead of free-text YYYY-MM-DD
- [ ] 10.23 Tag input: autocorrect/autocapitalize off
- [ ] 10.24 Capsule list cards show tags and key field values; list view differs meaningfully from card view
- [ ] 10.25 View toggle label is consistent (always names the current view or always the next); board view with "All" types doesn't hide every capsule behind a hint
- [ ] 10.26 Selected filter/sort chips are clearly distinguishable
- [ ] 10.27 Reminder screen: "notifications are off" shown once, with an "Open Settings" link
- [ ] 10.28 Capsule history entries say what changed
- [ ] 10.29 Inference settings: invalid numbers show an inline error
- [ ] 10.30 Create persona / Create snippet disabled until required fields are filled (consistent with Create type)
- [ ] 10.31 Models screen lists the voice (Whisper) model with delete, and shows size + a download button for downloadable models
- [ ] 10.32 Settings screen: drop the redundant "Settings" label under the header
- [ ] 10.34 Tab stacks (chat, capsules, settings) anchor to their index screen (`unstable_settings.initialRouteName`), so a screen opened directly into an unvisited tab — e.g. the palette's "Ephemeral chat", a notification's capsule — gets a back button to that tab's list (found 2026-10-16 verifying 10.5)
- [ ] 10.33 Version restore clears fields that were empty in the snapshot (found 2026-10-16: snapshots only record fields that have a value row, so restoring a version taken before a field was filled leaves the newer value in place)

### Phase 9 — Future releases (deferred)
- [ ] 9.1 Spike: CRDT model fit (Yjs vs Automerge) against the portable format
- [ ] 9.2 LAN device discovery + E2E-encrypted transport, fully isolated behind a flag
- [ ] 9.3 Conflict surfacing UI
- [ ] 9.4 Sync settings screen (off by default)
- [ ] 9.5 Full STT model management: `entities/stt-model` + download/selection UI
      mirroring 1.1–1.3 (`entities/model`, download, active-model selection).
      3.3.1's single-model first-run download is the chosen path for now (decided
      2026-08-16) — revisit only if multi-model choice for STT becomes a real need.
