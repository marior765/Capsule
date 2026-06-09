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
- [ ] FSD folder scaffolding + layer-import lint rule
- [ ] `shared/db` — SQLite client + migration runner
- [ ] `shared/storage` — MMKV settings wrapper
- [ ] `shared/ui` — baseline kit + unistyles theme (light/dark)
- [ ] `shared/llm` — llama.rn wrapper (init, load, complete, abort, model info)
- [ ] `shared/config` — feature flags, constants
- [ ] expo-router shell (`_layout`, tabs/stack) + empty routes
- [x] llama.rn Expo plugin config (app.json / app.config.js)

### Phase 1 — AI chat core ← start here
- [ ] `entities/model` — model metadata schema + CRUD
- [ ] `features/manage-models` — download GGUF from HuggingFace, list, delete, select
- [ ] `ModelPicker` widget with hardware-aware recommendations
- [ ] `entities/conversation` + `entities/message` — models + CRUD
- [ ] `features/send-message` — compose → stream LLM completion → persist
- [ ] `ChatThread` + `ChatBubble` (markdown + code blocks + copy) + `ChatInput`
- [ ] `InferenceStats` — token/sec + context usage display
- [ ] `features/manage-conversations` — create, rename, delete, search
- [ ] chat routes: `chat/index`, `chat/new`, `chat/[id]`
- [ ] models route: `models/index`
- [ ] Onboarding flow: welcome → download first model → first chat

### Phase 2 — AI configurability
- [ ] `features/configure-inference` — temperature, top-p/k, repeat penalty, context length, seed
- [ ] Settings → inference screen
- [ ] Custom system prompts / personas — create, edit, delete, select per conversation
- [ ] `PersonaSelector` widget + personas route
- [ ] `features/branch-conversation` — edit message → fork generation path, preserve tree
- [ ] Ephemeral chats (session-only, never written to disk)

### Phase 3 — Voice
- [ ] `shared/stt` — whisper.rn wrapper (init, record, transcribe, abort)
- [ ] whisper.rn Expo plugin config
- [ ] `features/voice-input` — hold-to-record → transcribe → insert into ChatInput
- [ ] `VoiceRecordButton` widget
- [ ] Local TTS for assistant responses (OS-level Speech API as baseline)

### Phase 4 — Privacy core ← key differentiators
- [ ] `features/encrypt-vault` — at-rest encryption (SQLCipher) + key in secure store
- [ ] `features/app-lock` — biometric / passphrase gate on launch & resume
- [ ] `entities/audit` + `PrivacyBanner` egress indicator + `EgressLog` viewer
- [ ] Settings → privacy screen
- [ ] `features/wipe-data` — secure full wipe (models, chats, capsules, settings)

### Phase 5 — Portability ← key differentiator
- [ ] `shared/format` — versioned portable format spec + serializers
- [ ] `features/import-export` (single conversation, single capsule, whole vault)
- [ ] `features/backup-restore`
- [ ] Migration importers (ChatGPT export, Claude export, CSV, JSON, Markdown)

### Phase 6 — Capsule data core
- [ ] `entities/capsule`, `entities/field`, `entities/capsule-type` — models + CRUD
- [ ] `CapsuleEditor` + `FieldRenderer` for base field types
- [ ] `CapsuleList` + `CapsuleCard`, capsules routes
- [ ] Create / edit / delete capsule flows
- [ ] Search, filter, sort
- [ ] Tags / collections
- [ ] `SchemaBuilder` + manage-schema feature
- [ ] Relation + attachment field types
- [ ] `entities/link` with graceful missing-target handling
- [ ] Field validation

### Phase 7 — AI × data (hard)
- [ ] Spike: local embedding model via llama.rn (or separate small model)
- [ ] `features/capsule-rag` — index capsules into local vector store, retrieval at query time
- [ ] "Chat with your capsules" mode — toggle in chat that grounds responses in the user's data
- [ ] RAG context shown transparently (which capsules were referenced)

### Phase 8 — Polish & depth
- [ ] Multiple backends toggle (optional cloud APIs behind consent gate)
- [ ] Prompt/snippet library
- [ ] Chat export as markdown
- [ ] Image/vision input (multimodal models)
- [ ] Capsule nesting + version history + bulk operations
- [ ] Quick capture + command palette
- [ ] Multiple capsule views (card / board)
- [ ] Local reminders (on-device notifications)
- [ ] Accessibility pass

### Phase 9 — Serverless sync (deferred)
- [ ] Spike: CRDT model fit (Yjs vs Automerge) against the portable format
- [ ] LAN device discovery + E2E-encrypted transport, fully isolated behind a flag
- [ ] Conflict surfacing UI
- [ ] Sync settings screen (off by default)
