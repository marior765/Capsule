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
- [ ] 1.1 `entities/model` — model metadata schema + CRUD
- [ ] 1.2 `features/manage-models` — download GGUF from HuggingFace, list, delete, select
- [ ] 1.3 `ModelPicker` widget with hardware-aware recommendations
- [ ] 1.4 `entities/conversation` + `entities/message` — models + CRUD
- [ ] 1.5 `features/send-message` — compose → stream LLM completion → persist
- [ ] 1.6 `ChatThread` + `ChatBubble` (markdown + code blocks + copy) + `ChatInput`
- [ ] 1.7 `InferenceStats` — token/sec + context usage display
- [ ] 1.8 `features/manage-conversations` — create, rename, delete, search
- [ ] 1.9 chat routes: `chat/index`, `chat/new`, `chat/[id]`
- [ ] 1.10 models route: `models/index`
- [ ] 1.11 Onboarding flow: welcome → download first model → first chat

### Phase 2 — AI configurability
- [ ] 2.1 `features/configure-inference` — temperature, top-p/k, repeat penalty, context length, seed
- [ ] 2.2 Settings → inference screen
- [ ] 2.3 Custom system prompts / personas — create, edit, delete, select per conversation
- [ ] 2.4 `PersonaSelector` widget + personas route
- [ ] 2.5 `features/branch-conversation` — edit message → fork generation path, preserve tree
- [ ] 2.6 Ephemeral chats (session-only, never written to disk)

### Phase 3 — Voice
- [ ] 3.1 `shared/stt` — whisper.rn wrapper (init, record, transcribe, abort)
- [ ] 3.2 whisper.rn Expo plugin config
- [ ] 3.3 `features/voice-input` — hold-to-record → transcribe → insert into ChatInput
- [ ] 3.4 `VoiceRecordButton` widget
- [ ] 3.5 Local TTS for assistant responses (OS-level Speech API as baseline)

### Phase 4 — Privacy core ← key differentiators
- [ ] 4.1 `features/encrypt-vault` — at-rest encryption (SQLCipher) + key in secure store
- [ ] 4.2 `features/app-lock` — biometric / passphrase gate on launch & resume
- [ ] 4.3 `entities/audit` + `PrivacyBanner` egress indicator + `EgressLog` viewer
- [ ] 4.4 Settings → privacy screen
- [ ] 4.5 `features/wipe-data` — secure full wipe (models, chats, capsules, settings)

### Phase 5 — Portability ← key differentiator
- [ ] 5.1 `shared/format` — versioned portable format spec + serializers
- [ ] 5.2 `features/import-export` (single conversation, single capsule, whole vault)
- [ ] 5.3 `features/backup-restore`
- [ ] 5.4 Migration importers (ChatGPT export, Claude export, CSV, JSON, Markdown)

### Phase 6 — Capsule data core
- [ ] 6.1 `entities/capsule`, `entities/field`, `entities/capsule-type` — models + CRUD
- [ ] 6.2 `CapsuleEditor` + `FieldRenderer` for base field types
- [ ] 6.3 `CapsuleList` + `CapsuleCard`, capsules routes
- [ ] 6.4 Create / edit / delete capsule flows
- [ ] 6.5 Search, filter, sort
- [ ] 6.6 Tags / collections
- [ ] 6.7 `SchemaBuilder` + manage-schema feature
- [ ] 6.8 Relation + attachment field types
- [ ] 6.9 `entities/link` with graceful missing-target handling
- [ ] 6.10 Field validation

### Phase 7 — AI × data (hard)
- [ ] 7.1 Spike: local embedding model via llama.rn (or separate small model)
- [ ] 7.2 `features/capsule-rag` — index capsules into local vector store, retrieval at query time
- [ ] 7.3 "Chat with your capsules" mode — toggle in chat that grounds responses in the user's data
- [ ] 7.4 RAG context shown transparently (which capsules were referenced)

### Phase 8 — Polish & depth
- [ ] 8.1 Multiple backends toggle (optional cloud APIs behind consent gate)
- [ ] 8.2 Prompt/snippet library
- [ ] 8.3 Chat export as markdown
- [ ] 8.4 Image/vision input (multimodal models)
- [ ] 8.5 Capsule nesting + version history + bulk operations
- [ ] 8.6 Quick capture + command palette
- [ ] 8.7 Multiple capsule views (card / board)
- [ ] 8.8 Local reminders (on-device notifications)
- [ ] 8.9 Accessibility pass

### Phase 9 — Serverless sync (deferred)
- [ ] 9.1 Spike: CRDT model fit (Yjs vs Automerge) against the portable format
- [ ] 9.2 LAN device discovery + E2E-encrypted transport, fully isolated behind a flag
- [ ] 9.3 Conflict surfacing UI
- [ ] 9.4 Sync settings screen (off by default)
