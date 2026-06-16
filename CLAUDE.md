# Capsule

> Offline-first. Fully private. Configurable. Self-contained.

@docs/AGENTS.md

---

## Standing Instructions for Every Session

These apply to every conversation, without the user needing to repeat them.

### docs/ARTICLE.md — development journal
After any action worth including in an article about AI-assisted mobile development,
append a dated entry to `docs/ARTICLE.md`. Think like a journalist: log the *what*,
the *why*, and especially the *article angle* — the insight a reader would take away.
Include: setup decisions, architectural choices, AI workflows used, mistakes and
corrections, tools discovered. Skip purely mechanical steps with no insight value.

### docs/DEVELOPMENT_PLAN.md — progress tracking
When completing any task that maps to a checklist item in `docs/DEVELOPMENT_PLAN.md`,
mark it `[x]` immediately. Keep the file current so it always reflects real progress.

### docs/CHEATSHEET.md — AI features catalog
The list below are **one-shot triggers**. When a feature is used for the first time:
1. Update `docs/CHEATSHEET.md` — flip its row to ✅, add an entry under "Features"
   with what it is, how it works, and how it was used here.
2. Remove that feature's line from this list immediately.

**Pending triggers (remove each line on first use):**
- Loops — first `/loop` invoked
- Scheduled agents — first `/schedule` used
- Memory — first persistent memory written
- Plan mode — first time plan mode is entered
- Built-in skills — first time `/code-review`, `/verify`, or similar is invoked

---

## Core Philosophy

Non-negotiable. Every decision is evaluated against these:

1. **Offline-first** — Fully functional with zero network. Network absence is the default assumption.
2. **Fully private** — No external servers, no analytics, no telemetry, no SDKs that phone home. All data stays local. Privacy must be *verifiable*.
3. **Self-contained entities** — Each capsule is independent. It carries its own data, schema, and config. No hidden dependencies.
4. **Configurable** — Prefer exposing configuration over hardcoding opinions.

---

## Hard Rules

- **Never introduce network calls in core logic.** Network features must be opt-in, user-initiated, clearly isolated.
- **Never send data to external services** — no error reporting, no CDN-loaded assets at runtime, no remote feature flags.
- **All storage must be local** — SQLite, flat files, or equivalent. No Firebase, Supabase, PocketBase (remote), or similar.
- **Dependencies must be audited** — verify no outbound requests at runtime before adding any library.
- **Model download is the one allowed network action** — user-initiated, clearly indicated. Once downloaded, everything runs locally.

---

## Stack

- **Platform:** React Native (iOS + Android) via Expo SDK 56
- **Navigation:** expo-router (file-based; routes root = `src/app/`)
- **Styling:** react-native-unistyles (tokens in `shared/ui/theme.ts`)
- **Animations:** react-native-reanimated 4
- **Storage:** expo-sqlite (structured data) + MMKV (settings / key-value)
- **LLM:** llama.rn (JSI → llama.cpp; GGUF models, GPU via Metal/OpenCL)
- **STT:** whisper.rn (JSI → whisper.cpp; on-device) — Phase 3
- **Crypto (planned):** SQLCipher via expo-sqlite + expo-secure-store / Keychain
- **Sync (deferred):** Yjs or Automerge + LAN transport, behind a feature flag

---

## Entity Model

Two core domains: **AI chat** and **structured data (capsules)**. Same privacy/storage foundation; will connect via local RAG.

**AI domain:** `Conversation` · `Message` · `Model`

**Capsule domain:**
- `Capsule` — the unit; holds values + embedded schema reference
- `CapsuleType` — reusable schema/template
- `CapsuleField` — typed field def (text, number, date, boolean, select, relation, attachment…)
- `CapsuleValue` — data stored against a field
- `CapsuleLink` — relation between capsules; must degrade gracefully if target missing
- `Tag` / `Collection` — optional organization; never required for a capsule to function
- `Attachment` — local file/image, on-device only

When modeling: *"Does this capsule make sense on its own, without relying on external state?"*

---

## Project Conventions

- Discuss architecture and approach **before** writing code for any non-trivial feature
- Use **plan mode** for multi-file changes
- Keep business logic decoupled from UI — LLM and capsule operations must be testable without rendering
- `shared/llm` owns all llama.rn interaction — features never call llama.rn directly
- `shared/stt` owns all whisper.rn interaction — same principle
- Explicit types everywhere; no `any`
- Name things after the domain: `Conversation`, `Message`, `Model`, `Capsule`, `CapsuleField`, etc.
- Each slice exposes a single `index.ts` public API — never import from internal files of another slice
- Every persisted entity must round-trip through the portable format
- Privacy-sensitive actions (export, decrypt, wipe, model download) must write to the `audit` entity
- Every interactive UI element must have a `testID` — always via the component's `testIDs` object, never a hardcoded string inline

---

## testID Conventions

testIDs are required on every interactive element. The utilities live in `shared/testing/`.

### Rules
- **Never hardcode testID strings inline.** Always reference through the component's `testIDs` object.
- **Define testIDs at the bottom of every component file** using `createComponentTestIDs`.
- **Expose as a static property:** `ComponentName.testIDs = testIDs`
- **Inherit child testIDs** via `extendIDs(ChildComponent.testIDs.category)`

### Categories and prefixes
| Category | Prefix | Use for |
|---|---|---|
| `buttons` | `btn` | `<Button>`, `<Pressable>` acting as button |
| `inputs` | `input` | `<TextInput>` and wrappers |
| `labels` | `lbl` | Static text labels |
| `texts` | `text` | Body / dynamic text |
| `icons` | `icon` | `<SvgIcon>`, icon components |
| `images` | `img` | `<Image>` |
| `containers` | `container` | Wrapping `<View>` that needs targeting |
| `pressables` | `pressable` | Generic `<Pressable>` / `<TouchableOpacity>` |
| `headers` | `header` | Screen / section headers |
| `dialogs` | `dialog` | Modal dialogs |
| `sheets` | `sheet` | Bottom sheets |

### Pattern
```tsx
// At the bottom of every component file:
const testIDs = createComponentTestIDs(MyComponent.name, {
  buttons: ['primary', 'cancel'] as const,
  inputs: ['search'] as const,
  labels: extendIDs(ChildComponent.testIDs.labels),
});

MyComponent.testIDs = testIDs;

// Usage inside JSX:
<Button testID={testIDs.buttons.primary} />
<TextInput testID={testIDs.inputs.search} />
```

### Built ID format
`prefix_ComponentName_elementName` — generated by `buildTestID` inside `createComponentTestIDs`. Never construct this string manually.

---

## What to Avoid

- Cloud-first patterns (auth flows assuming a server, API-first data fetching)
- Libraries requiring internet to function (exception: model download, user-initiated only)
- Global mutable state shared across unrelated conversations or capsules
- Over-engineering sync before the local-first core is solid
- Calling llama.rn or whisper.rn outside their `shared/` wrappers
- Bundling models in the app binary

---

## Reference docs (not auto-loaded)

- [docs/AGENTS.md](docs/AGENTS.md) — agent ground rules
- [docs/DESIGN.md](docs/DESIGN.md) — design tokens, spacing, typography, layout constants
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — FSD layer rules, full slice map, navigation structure
- [docs/DEVELOPMENT_PLAN.md](docs/DEVELOPMENT_PLAN.md) — feature sets + phased roadmap
- [docs/ARTICLE.md](docs/ARTICLE.md) — development diary
- [docs/CHEATSHEET.md](docs/CHEATSHEET.md) — AI features catalog
