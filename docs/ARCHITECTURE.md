# Architecture

## Feature Sliced Design

The project follows [Feature Sliced Design](https://feature-sliced.design/) (FSD).

```
src/
  app/        # FSD pages layer + expo-router entry — route files and app-wide providers
  widgets/    # Composite UI blocks assembled from features/entities (e.g. ChatThread)
  features/   # User-facing interactions with business logic (e.g. sendMessage)
  entities/   # Domain models and their local CRUD (e.g. conversation, capsule)
  shared/     # Reusable primitives: UI kit, db client, llm client, utils, types
```

`src/app/` serves a dual role: FSD **pages** layer + expo-router routing root. No separate `src/pages/` — expo-router's convention IS the pages layer.

**Layer rules (strictly enforced):**
- A layer may only import from layers **below** it — never same or higher
- Cross-slice imports within the same layer are forbidden; use the public `index.ts` API
- `shared/` has no knowledge of any domain concept
- `src/app/` route files contain no business logic — delegate to features/widgets

---

## Slice Map

Build slices as needed by the roadmap, not all upfront.

```
src/
  app/
    providers/            # theme, db init, llm engine init, app-lock gate, unistyles registry
    _layout.tsx           # root layout; mounts providers

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

Routes are **thin shells** — import widgets/features, wire params, nothing more.

```
src/app/
  (app)/
    _layout.tsx                 # tab or stack shell; mounts app-lock gate
    index.tsx                   # home: recent conversations + pinned capsules

    chat/
      index.tsx                 # conversation list
      new.tsx                   # start new conversation (picks model + optional persona)
      [id].tsx                  # active chat thread (ChatThread + ChatInput)
    models/
      index.tsx                 # downloaded models, download new, delete
    personas/
      index.tsx                 # manage system prompts / personas

    capsules/
      index.tsx                 # all capsules (list + search + filter)
      new.tsx                   # create flow (pick type → CapsuleEditor)
      [id].tsx                  # capsule detail
      [id]/edit.tsx             # edit existing capsule
    types/
      index.tsx                 # manage CapsuleTypes / templates
      new.tsx                   # SchemaBuilder for a new type
      [id].tsx                  # edit a type's schema

    search.tsx                  # unified search (conversations + capsules)
    settings/
      index.tsx                 # settings hub
      privacy.tsx               # app-lock, wipe, audit log, egress indicator
      storage.tsx               # encryption status, backup/restore
      inference.tsx             # default sampling params, context length
      import-export.tsx
      appearance.tsx            # theme
      sync.tsx                  # DEFERRED — LAN sync controls, off by default
  onboarding.tsx                # first-run: welcome → download first model → first chat
```
