# Capsule

> Offline-first. Fully private. Configurable. Self-contained.

Capsule is a personal, offline-first AI + data app. It combines on-device LLM chat (via llama.rn) with structured personal data management built around **self-closed entities** — discrete, independent units of information that live entirely on the user's device. No cloud. No external servers. No data leaving the machine.

The product is an offline, privacy-verifiable alternative to cloud AI assistants (ChatGPT, Claude, Gemini) — one that also understands and reasons over the user's own structured data.

---

## Core Philosophy

These are non-negotiable principles. Every decision should be evaluated against them:

1. **Offline-first** — The app must be fully functional with zero network connectivity. Network absence is the default assumption, not an edge case.
2. **Fully private** — No external servers, no analytics, no telemetry, no third-party SDKs that phone home. All data stays local. Privacy should be *verifiable*, not just claimed.
3. **Self-contained entities** — Each "capsule" is an independent, self-closed unit. It carries its own data, schema, and configuration. Capsules do not have hidden dependencies on each other.
4. **Configurable** — Behavior, structure, and appearance should be user-controlled wherever reasonable. Prefer exposing configuration over hardcoding opinions.

---

## Hard Rules

- **Never introduce network calls in core logic.** If a network feature is ever added (e.g. local sync over LAN, model download), it must be opt-in, user-initiated, and clearly isolated.
- **Never send data to external services** — no error reporting services, no CDN-loaded assets at runtime, no remote feature flags.
- **All storage must be local** — SQLite, flat files, or equivalent. No Firebase, Supabase, PocketBase (remote), or similar.
- **Dependencies must be audited** — before adding any third-party library, verify it does not make outbound requests at runtime.
- **Model download is the one allowed network action** — fetching GGUF models from Hugging Face is user-initiated, clearly indicated, and the only time the app touches the network. Once downloaded, everything runs locally.

---

## Entity Model

The app has two core domains: **AI chat** and **structured data (capsules)**. They share the same privacy/storage foundation and will eventually connect (AI that reasons over capsules).

### AI domain

- `Conversation` — a chat thread; holds messages + a reference to the model used
- `Message` — a single user or assistant turn; stores role, content, timestamps, token count
- `Model` — metadata for a downloaded GGUF model (name, path, size, quantization, parameters)

### Capsule domain

The central concept is the **Capsule entity** — a self-closed unit of data:

- Each capsule is independent and fully self-describing
- Capsules carry their own schema/type definition
- Capsules can be nested or linked, but must remain functional in isolation
- Capsule data must be exportable and portable (no proprietary lock-in)

When modeling features, ask: *"Does this capsule make sense on its own, without relying on external state?"*

**Working entity vocabulary** (extend as the model firms up):

- `Capsule` — the unit itself; holds values + an embedded reference to its type/schema
- `CapsuleType` — a reusable schema/template defining the fields a capsule has
- `CapsuleField` — a single typed field definition (text, number, date, boolean, select, relation, attachment, …)
- `CapsuleValue` — the data stored against a field for a given capsule
- `CapsuleLink` — an explicit relation between two capsules (must degrade gracefully if the target is missing)
- `Tag` / `Collection` — lightweight organization layered on top, never required for a capsule to function
- `Attachment` — a local file/image bound to a capsule, stored on-device only

---

## Feature Set

Features are grouped by strategic role. The product wins on the **Differentiators**, not the Baseline.

### Set 1 — Competitive baseline (table stakes)

Without these, the app looks unfinished next to existing local AI apps and personal data tools.

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
- [ ] Capsule CRUD (create, read, update, delete) with local persistence
- [ ] Custom field types: text, long-text, number, boolean, date/time, single-select, multi-select, relation, attachment
- [ ] Capsule types / templates (define a schema once, reuse it)
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

None of the comparable apps (LM Studio, Jan, Open WebUI, AnythingLLM, GPT4All) do these well. These are the direct expression of the Core Philosophy.

**Privacy:**
- [ ] **Encrypted-at-rest storage with a user-held key** — DB/files encrypted via passphrase or biometric-unlocked key (candidates: SQLCipher through expo-sqlite, key in expo-secure-store / Keychain). Flagship privacy feature.
- [ ] **Verifiable privacy** — a live egress indicator (always "nothing leaves the device" unless downloading a model) plus a readable audit log of any data-access/export/network events. Privacy you can *see*.
- [ ] **App lock** — biometric / passphrase gate on launch and on resume.
- [ ] **Instant full wipe** — one action to securely erase all local data (models, chats, capsules).
- [ ] **Ephemeral chats** — conversations that never persist to disk (session-only).

**Portability:**
- [ ] **Open, documented, portable format** — a versioned JSON spec for conversations and capsules. Import/export anywhere, zero lock-in.
- [ ] **Conversation branching** — edit a message and regenerate down a new path, with the full tree preserved. Mostly absent or clumsy in mobile AI apps.

**Voice:**
- [ ] **Fully local voice input** — on-device speech-to-text via whisper.rn (no cloud round-trip). A private voice assistant that works in airplane mode.
- [ ] **Local TTS** — on-device text-to-speech for assistant responses (OS-level TTS as baseline, explore local neural TTS later).

**AI + data integration:**
- [ ] **Chat with your capsules (local RAG)** — query your own structured data via local embeddings, entirely on-device. The AI understands *your* data without it ever leaving the phone. This is what cloud apps fundamentally cannot offer.

**Sync:**
- [ ] **Serverless LAN sync (CRDT-based)** — conversations and capsules sync directly between the user's own devices over the local network, end-to-end encrypted, no central server. *(Hard / deferred — see roadmap.)*

### Set 3 — Expected / assumed (polish & depth)

Inferred expectations for an app of this kind. Some reinforce the identity; some are quality polish.

**AI:**
- [ ] Multiple backend support: local llama.rn as default, optional cloud APIs (OpenAI, Anthropic) behind a clear, consent-gated toggle for users who want more power
- [ ] Prompt/snippet library
- [ ] Chat sharing (export a single conversation as markdown/JSON)
- [ ] Image/vision input (multimodal models that support it)
- [ ] Migration / import from ChatGPT / Claude exports

**Data:**
- [ ] Capsule linking / relations with graceful handling of missing targets
- [ ] Capsule nesting (a capsule containing capsules) while keeping each independent
- [ ] Local attachments (images/files) stored on-device
- [ ] Local backup / restore (export the whole vault to a single file)
- [ ] Migration / import from common formats (CSV, JSON, Markdown)
- [ ] Quick capture (fast "new capsule" entry)
- [ ] Multiple views per type (list / card / board)
- [ ] Capsule version history (local, undoable edits)
- [ ] Bulk operations (multi-select edit/delete/tag)
- [ ] Local reminders / date fields (via on-device notifications only)

**App-wide:**
- [ ] Pinning / favorites (conversations and capsules)
- [ ] Onboarding flow (first-run, download-your-first-model)
- [ ] Accessibility (screen-reader labels, dynamic text size)
- [ ] Command palette / quick actions

---

## Stack

- **Platform:** React Native (iOS + Android) via Expo SDK 56
- **Navigation:** expo-router (file-based routing; routes root = `src/app/`)
- **Styling:** react-native-unistyles (theme tokens in `shared/ui/theme.ts`)
- **Animations:** react-native-reanimated 4
- **Storage:** expo-sqlite (structured data) + MMKV (fast key-value / settings)
- **LLM inference:** llama.rn (JSI binding for llama.cpp; GGUF models, GPU offloading via Metal/OpenCL)
- **Speech-to-text:** whisper.rn (JSI binding for whisper.cpp; on-device Whisper models) — installed, used in Phase 3
- **Crypto (planned):** expo-sqlite with SQLCipher extension for at-rest encryption; expo-secure-store / Keychain for key storage
- **Sync (deferred):** a CRDT lib (Yjs or Automerge) + LAN discovery/transport, fully isolated behind a feature flag

---

## Design Tokens

All tokens live in `shared/ui/theme.ts` and are registered with unistyles via `UnistylesRegistry`. Never use raw values inline — always reference a token.

### Colors

| Token | Light | Dark | Usage |
|---|---|---|---|
| `text` | `#000000` | `#ffffff` | Primary text |
| `textSecondary` | `#60646C` | `#B0B4BA` | Labels, captions, placeholders |
| `background` | `#ffffff` | `#000000` | Screen / page background |
| `backgroundElement` | `#F0F0F3` | `#212225` | Cards, inputs, sheets |
| `backgroundSelected` | `#E0E1E6` | `#2E3135` | Pressed / selected states |

Add tokens here as the palette grows. Do not use hex values directly in component code.

### Spacing

4-point base grid. Multiply by 4 to get px.

| Token | px | Use |
|---|---|---|
| `xs` | 4 | Icon padding, tight gaps |
| `sm` | 8 | Inner element padding |
| `md` | 16 | Standard section padding |
| `lg` | 24 | Between sections |
| `xl` | 32 | Screen-level padding |
| `xxl` | 64 | Hero / splash gaps |

### Typography

System fonts via `Platform.select` — no custom font loading required.

| Token | iOS | Android/default |
|---|---|---|
| `sans` | `system-ui` | `normal` |
| `serif` | `ui-serif` | `serif` |
| `rounded` | `ui-rounded` | `normal` |
| `mono` | `ui-monospace` | `monospace` |

### Layout constants

- `MaxContentWidth`: `800` — cap content width on large screens / web
- `BottomTabInset`: `50` iOS / `80` Android — padding above the tab bar

---

## Architecture — Feature Sliced Design

The project follows [Feature Sliced Design](https://feature-sliced.design/) (FSD). Source lives under `src/` with these layers (top = most abstract, bottom = most concrete):

```
src/
  app/        # FSD pages layer + expo-router entry — route files and app-wide providers
  widgets/    # Composite UI blocks assembled from features/entities (e.g. ChatThread)
  features/   # User-facing interactions with business logic (e.g. sendMessage)
  entities/   # Domain models and their local CRUD (e.g. conversation, capsule)
  shared/     # Reusable primitives: UI kit, db client, llm client, utils, types
```

`src/app/` serves a dual role: it is both the FSD **pages** layer (thin route shells) and expo-router's file-based routing root. There is no separate `src/pages/` directory — expo-router's convention IS the pages layer. App-wide providers and the root `_layout.tsx` also live here.

**Layer rules (strictly enforced):**
- A layer may only import from layers **below** it — never from the same or higher layer
- Cross-slice imports within the same layer are forbidden; go through the public API (`index.ts`) of each slice
- `shared/` has no knowledge of any domain concept
- `src/app/` route files contain no business logic — delegate everything to features/widgets

### Concrete slice map

Build slices as they're needed by the roadmap, not all upfront.

```
src/
  app/
    providers/            # theme, db init, llm engine init, app-lock gate, unistyles registry
    _layout.tsx           # root layout; mounts providers
    # all expo-router route files live here (see Navigation Structure below)

  entities/
    conversation/         # Conversation model + local CRUD
    message/              # Message model + CRUD (linked to conversation)
    model/                # Downloaded model metadata + CRUD
    capsule/              # Capsule model + local CRUD
    capsule-type/         # schema/template model + CRUD
    field/                # CapsuleField definitions + value (de)serialization
    link/                 # CapsuleLink relations
    tag/                  # tags / collections
    attachment/           # local file/image references
    audit/                # audit-log records (privacy)

  features/
    # — AI chat —
    send-message/         # compose + stream LLM response
    manage-conversations/ # create, rename, delete, search conversations
    manage-models/        # download, delete, select active model
    configure-inference/  # sampling params, system prompt, persona selection
    voice-input/          # whisper.rn record → transcribe → insert into chat
    branch-conversation/  # edit message → fork a new path
    capsule-rag/          # DEFERRED — local embeddings + retrieval over capsules

    # — Capsules —
    create-capsule/
    edit-capsule/
    delete-capsule/
    search-capsules/
    filter-sort-capsules/
    manage-schema/        # build/edit a CapsuleType
    link-capsules/
    tag-capsule/

    # — App-wide —
    import-export/        # portable-format read/write (conversations + capsules)
    backup-restore/
    encrypt-vault/        # at-rest encryption setup + unlock
    app-lock/             # biometric / passphrase gate
    wipe-data/
    lan-sync/             # DEFERRED — isolated, flagged off by default

  widgets/
    # — AI chat —
    ChatThread/           # scrollable message list with streaming indicator
    ChatBubble/           # single message (user / assistant), markdown rendered
    ChatInput/            # text input + send button + voice button
    ModelPicker/          # model selection sheet with hardware info
    InferenceStats/       # token/sec, context usage, model info
    PersonaSelector/      # pick a saved system prompt / persona
    VoiceRecordButton/    # hold-to-record with whisper.rn

    # — Capsules —
    CapsuleCard/          # summary tile for lists
    CapsuleList/          # virtualized list + empty states
    CapsuleEditor/        # full edit form driven by a CapsuleType
    FieldRenderer/        # renders/edits a single field by type
    SchemaBuilder/        # UI for manage-schema
    SearchBar/
    FilterSheet/
    QuickCapture/         # fast new-capsule entry

    # — App-wide —
    PrivacyBanner/        # egress indicator
    EgressLog/            # audit log viewer

  shared/
    ui/                   # buttons, inputs, sheets, icons (domain-agnostic)
    db/                   # sqlite client + migrations
    llm/                  # llama.rn wrapper: init context, completion, abort, model info
    stt/                  # whisper.rn wrapper: init, record, transcribe
    storage/              # MMKV wrapper for settings
    crypto/               # key handling, encrypt/decrypt helpers
    format/               # portable format schema + (de)serializers
    lib/                  # pure utils
    types/                # shared TS types (no domain logic)
    config/               # feature flags, constants
```

---

## Navigation Structure (expo-router)

File-based routes under `src/app/`. Routes are **thin shells** — they import widgets/features and wire params, nothing more.

```
(app)/
  _layout.tsx                 # tab or stack shell; mounts app-lock gate
  index.tsx                   # home: recent conversations + pinned capsules

  # — AI chat —
  chat/
    index.tsx                 # conversation list
    new.tsx                   # start new conversation (picks model + optional persona)
    [id].tsx                  # active chat thread (ChatThread + ChatInput)
  models/
    index.tsx                 # downloaded models, download new, delete
  personas/
    index.tsx                 # manage system prompts / personas

  # — Capsules —
  capsules/
    index.tsx                 # all capsules (list + search + filter)
    new.tsx                   # create flow (pick type → CapsuleEditor)
    [id].tsx                  # capsule detail
    [id]/edit.tsx             # edit existing capsule
  types/
    index.tsx                 # manage CapsuleTypes / templates
    new.tsx                   # SchemaBuilder for a new type
    [id].tsx                  # edit a type's schema

  # — App-wide —
  search.tsx                  # unified search (conversations + capsules)
  settings/
    index.tsx                 # settings hub
    privacy.tsx               # app-lock, wipe, audit log, egress indicator
    storage.tsx               # encryption status, backup/restore
    inference.tsx             # default sampling params, context length
    import-export.tsx
    appearance.tsx            # theme
    sync.tsx                  # DEFERRED — LAN sync controls, off by default
  onboarding.tsx              # first-run: welcome → download first model → first chat
```

---

## Project Conventions

- Discuss architecture and approach **before** writing code for any non-trivial feature
- Prefer **plan mode** for multi-file changes
- Keep business logic decoupled from UI — LLM operations and capsule operations should be testable without rendering anything
- The `shared/llm` wrapper owns all llama.rn interaction — features never call llama.rn directly
- The `shared/stt` wrapper owns all whisper.rn interaction — same principle
- Use explicit types everywhere; avoid `any` / untyped structures
- Name things after the domain: `Conversation`, `Message`, `Model`, `Capsule`, `CapsuleField`, etc.
- Each slice exposes a single `index.ts` public API — never import from internal files of another slice
- Every persisted entity must be representable in the **portable format** — if a feature can't round-trip through export/import, reconsider it
- Privacy-sensitive actions (export, decrypt, wipe, model download) must write an entry to the `audit` entity

---

## What to Avoid

- Cloud-first patterns (auth flows that assume a server, API-first data fetching)
- Libraries that require an internet connection to function (exception: model download, user-initiated only)
- Global mutable state shared across unrelated conversations or capsules
- Over-engineering the sync layer before the local-first core is solid
- Calling llama.rn or whisper.rn outside their `shared/` wrappers
- Bundling models in the app binary — models are always downloaded separately by the user

---

## Development Plan

Phased so the AI core and local-first foundation ship first. Check items off as they land. Each phase should be shippable on its own.

### Phase 0 — Foundation
- [ ] FSD folder scaffolding + layer-import lint rule (enforce import direction)
- [ ] `shared/db` — SQLite client (expo-sqlite) + migration runner
- [ ] `shared/storage` — MMKV settings wrapper
- [ ] `shared/ui` — baseline kit + unistyles theme (light/dark), design tokens in `theme.ts`
- [ ] `shared/llm` — llama.rn wrapper (init context, load model, run completion, abort, get model info)
- [ ] `shared/config` — feature flags, constants
- [ ] expo-router shell (`_layout`, tabs/stack) + empty routes
- [x] llama.rn Expo plugin config (app.json / app.config.js)

### Phase 1 — AI chat core (Set 1)  ← start here
- [ ] `entities/model` — model metadata schema + CRUD
- [ ] `features/manage-models` — download GGUF from HuggingFace, list, delete, select
- [ ] `ModelPicker` widget with hardware-aware recommendations (RAM detection + model size hints)
- [ ] `entities/conversation` + `entities/message` — models + CRUD
- [ ] `features/send-message` — compose user message → stream LLM completion → persist
- [ ] `ChatThread` + `ChatBubble` (markdown + code blocks + copy) + `ChatInput`
- [ ] `InferenceStats` — token/sec + context usage display
- [ ] `features/manage-conversations` — create, rename, delete, search
- [ ] chat routes: `chat/index`, `chat/new`, `chat/[id]`
- [ ] models route: `models/index`
- [ ] Onboarding flow: welcome → download first model → first chat

### Phase 2 — AI configurability (Set 1 + Set 2)
- [ ] `features/configure-inference` — temperature, top-p/k, repeat penalty, context length, seed
- [ ] Settings → inference screen
- [ ] Custom system prompts / personas — create, edit, delete, select per conversation
- [ ] `PersonaSelector` widget + personas route
- [ ] `features/branch-conversation` — edit a message → fork a new generation path, preserve tree
- [ ] Ephemeral chats (session-only, never written to disk)

### Phase 3 — Voice (Set 2)
- [ ] `shared/stt` — whisper.rn wrapper (init context, record, transcribe, abort)
- [ ] whisper.rn Expo plugin config
- [ ] `features/voice-input` — hold-to-record → transcribe → insert into ChatInput
- [ ] `VoiceRecordButton` widget
- [ ] Local TTS for assistant responses (OS-level Speech API as baseline)

### Phase 4 — Privacy core (Set 2)  ← key differentiators
- [ ] `features/encrypt-vault` — at-rest encryption (SQLCipher via expo-sqlite) + key in secure store
- [ ] `features/app-lock` — biometric / passphrase gate on launch & resume
- [ ] `entities/audit` + `PrivacyBanner` egress indicator + `EgressLog` viewer
- [ ] Settings → privacy screen
- [ ] `features/wipe-data` — secure full wipe (models, chats, capsules, settings)

### Phase 5 — Portability (Set 2)  ← key differentiator
- [ ] `shared/format` — versioned portable format spec + serializers (conversations + capsules)
- [ ] `features/import-export` (single conversation, single capsule, whole vault)
- [ ] `features/backup-restore`
- [ ] Migration importers (ChatGPT export, Claude export, CSV, JSON, Markdown)

### Phase 6 — Capsule data core (Set 1)
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

### Phase 7 — AI × data (Set 2, hard)
- [ ] Spike: local embedding model via llama.rn (or separate small model)
- [ ] `features/capsule-rag` — index capsules into local vector store, retrieval at query time
- [ ] "Chat with your capsules" mode — toggle in chat that grounds responses in the user's data
- [ ] RAG context shown transparently (which capsules were referenced)

### Phase 8 — Polish & depth (Set 3)
- [ ] Multiple backends toggle (optional cloud APIs behind consent gate)
- [ ] Prompt/snippet library
- [ ] Chat export as markdown
- [ ] Image/vision input (multimodal models)
- [ ] Capsule nesting + version history + bulk operations
- [ ] Quick capture + command palette
- [ ] Multiple capsule views (card / board)
- [ ] Local reminders (on-device notifications)
- [ ] Accessibility pass

### Phase 9 — Serverless sync (Set 2, hard / deferred)
- [ ] Spike: CRDT model fit (Yjs vs Automerge) against the portable format
- [ ] LAN device discovery + E2E-encrypted transport, fully isolated behind a flag
- [ ] Conflict surfacing UI
- [ ] Sync settings screen (off by default)

> **Recommended launch wedge: Phases 0–5.** That delivers a fully functional, visibly-more-private offline AI chat app with voice, encryption, app lock, wipe, branching, and portable data — before taking on the capsule data layer or the hardest items (RAG, sync). The AI chat alone is the hook; capsules are the depth that retains.

---

## Context

This file was bootstrapped from the initial product design conversation and extended with the full feature set (AI + data), architecture/navigation/component structure, and a phased development plan. Update it as the stack, conventions, entity model, and roadmap evolve. Treat the checkboxes as living progress tracking.