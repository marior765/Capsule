# Capsule

> Offline-first. Fully private. Configurable. Self-contained.

Capsule is a React Native app that runs AI chat and structured personal data entirely on your device — no servers, no telemetry, no network required. Every model inference, every search, every byte of your data stays local.

---

## What it does

**AI Chat** — talk to large language models without sending a single token to the cloud. Models run via [llama.cpp](https://github.com/ggerganov/llama.cpp) through the [llama.rn](https://github.com/mybigday/llama.rn) JSI bridge. Download a GGUF model once; everything else works in airplane mode.

**Capsules** — a structured personal database with custom schemas. Define your own field types (text, number, date, boolean, select, relation, attachment), create reusable templates, and keep records that belong to you.

**AI × Data (coming)** — local RAG that lets you chat with your own capsules using on-device embeddings. No data leaves your device.

---

## Core principles

| Principle | What it means in practice |
|---|---|
| Offline-first | Zero network = fully functional. Network absence is the default assumption. |
| Fully private | No external servers, no analytics, no SDKs that phone home. Privacy is verifiable. |
| Self-contained | Each capsule carries its own data and schema. No hidden dependencies. |
| Configurable | Expose configuration rather than hardcode opinions. |

---

## Stack

| Layer | Technology |
|---|---|
| Platform | React Native (iOS + Android) · Expo SDK 56 |
| Navigation | expo-router (file-based routing) |
| Styling | react-native-unistyles |
| Animations | react-native-reanimated 4 |
| Structured storage | expo-sqlite |
| Key-value / settings | MMKV |
| On-device LLM | llama.rn → llama.cpp (GGUF, Metal / OpenCL GPU) |
| On-device STT | whisper.rn → whisper.cpp *(Phase 3)* |
| Encryption | SQLCipher + expo-secure-store / Keychain *(Phase 4)* |
| Sync | CRDT-based LAN sync, flagged off by default *(deferred)* |

---

## Architecture

The project follows [Feature Sliced Design](https://feature-sliced.design/) (FSD):

```
src/
  app/        # expo-router routes + app-wide providers
  widgets/    # composite UI blocks (ChatThread, CapsuleEditor, …)
  features/   # user interactions with business logic (send-message, manage-models, …)
  entities/   # domain models + local CRUD (conversation, message, capsule, …)
  shared/     # reusable primitives: ui kit, db client, llm/stt wrappers, utils
```

Layer rule: each layer may only import from layers below it. `shared/llm` owns all llama.rn interaction — nothing else calls it directly.

---

## Roadmap

The app ships in phases, each independently usable:

- **Phase 0** — Foundation (db, storage, theme, llm wrapper, router shell)
- **Phase 1** — AI chat core (model download, streaming inference, conversation management)
- **Phase 2** — AI configurability (sampling params, personas, conversation branching)
- **Phase 3** — Voice (on-device STT + TTS)
- **Phase 4** — Privacy core (encryption at rest, app lock, audit log, secure wipe)
- **Phase 5** — Portability (open portable format, import/export, migration from ChatGPT/Claude)
- **Phase 6** — Capsule data core (custom schemas, search, filter, relations)
- **Phase 7** — AI × data (local RAG over capsules)
- **Phase 8** — Polish (multimodal, prompt library, accessibility, command palette)
- **Phase 9** — LAN sync (CRDT-based, device-to-device, E2E encrypted, off by default)

See [docs/DEVELOPMENT_PLAN.md](docs/DEVELOPMENT_PLAN.md) for the full checklist.

---

## Privacy guarantee

- **No outbound requests** from core logic — ever.
- Model download is the single allowed network action; it is user-initiated and clearly indicated.
- All storage is local: SQLite files and MMKV on your device.
- A live egress indicator and audit log make privacy verifiable, not just claimed.
- Every dependency is audited for runtime outbound requests before being added.

---

## Getting started

```bash
# Install dependencies
npm install

# iOS
npx expo run:ios

# Android
npx expo run:android
```

> llama.rn requires a native build — Expo Go is not supported. Use a development build.

---

## Docs

- [Architecture](docs/ARCHITECTURE.md) — FSD layer rules, slice map, navigation structure
- [Development Plan](docs/DEVELOPMENT_PLAN.md) — phased roadmap with task checklist
- [Design](docs/DESIGN.md) — tokens, spacing, typography, layout constants

---

## License

MIT
