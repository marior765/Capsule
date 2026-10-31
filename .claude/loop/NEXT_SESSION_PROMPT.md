Repo: github.com/marior765/Capsule. Capsule is an offline-first, private React Native app (Expo SDK 56, expo-router, expo-sqlite, llama.rn). Read CLAUDE.md first; it covers the rules: FSD layers, no `any`, testIDs via createComponentTestIDs, no network calls.

## Where things stand
- Branch `claude/adoring-mendel-b6xo75` is pushed and has NO pull request yet. On top of `main` (67ac30b), it adds:
  - `7dff533` feat(10.35): the branch switcher counts only the conversation's own first messages. `entities/message` gets `getSiblings`; `getChildren` no longer accepts null; `features/branch-conversation` gets `getBranchPosition` and `findSiblingBranchLeaf`, used by `src/app/(app)/(tabs)/chat/[id].tsx`.
  - `f0f8609` feat(10.33): version restore clears fields that were empty in the snapshot, including fields added to the type afterwards. That decision is documented in `restoreCapsuleVersion`'s doc comment and in journal beat 127.
  - loop bookkeeping: plan boxes ticked, `.claude/loop/state.json` / `journal.md` / `BLOCKED.md` updated, a `docs/ARTICLE.md` entry, and `.claude/loop/PR_BODY.md`.
- Gate on that branch: `npx tsc --noEmit` is clean, `npx jest --passWithNoTests` passes 1705/1705, and `npx eslint src` has 0 errors. Run `npm ci` first.
- Both steps passed an independent reviewer subagent on the first attempt. Neither has been checked in a simulator; the manual checks are in `.claude/loop/BLOCKED.md` (sections "10.35 …" and "10.33 …").
- The previous session could not open the PR because GitHub tools were missing and the `gh` token was invalid. GitHub is now connected.

## Do now
1. Check that GitHub access works (the GitHub MCP tools). If it doesn't, stop and tell me.
2. Open ONE pull request from `claude/adoring-mendel-b6xo75` to `main`:
   - Title: "Phase 10: 10.35 + 10.33".
   - Body: the contents of `.claude/loop/PR_BODY.md`.
   - Check first for a PR template and mirror its headings if there is one.
3. Then delete `.claude/loop/PR_BODY.md` and `.claude/loop/NEXT_SESSION_PROMPT.md` from the branch in one small commit ("chore: drop handoff files"), and push.
4. Subscribe to the PR's activity so review comments and CI failures reach you. Fix CI failures on the branch: reproduce the failure first, then show the same check passing.
5. Do NOT merge until I explicitly say "merge it" in this session. Never push to `main` directly and never force-push.

## Pending decisions (ask me before acting on any of these)
- `.claude/audit.log` (a hook log) changes on every command and triggers the stop hook. Should it go in `.gitignore`?
- 10.14 is quarantined: Android chat follow-scroll. A patch is saved in `.claude/loop/patches/10.14-follow-state-machine.patch`, and the next steps are listed in BLOCKED.md.
- 10.1 Android voice input: record PCM with `@fugood/react-native-audio-pcm-stream` and write the WAV header ourselves (recommended), use expo-audio's `useAudioStream`, or decode AAC?
- Add `@testing-library/react-native` plus a unistyles Jest mock for component render tests?
- Quick-capture field parsing; tap-latency profiling; 8.1 cloud backends (needs provider, consent and key-storage decisions); vault reset leaving files on disk.

The full list of open items and device checks is in `.claude/loop/BLOCKED.md`. Some sections there are stale: the 5.2/5.4 "not ticked" mismatches have since been ticked, and the attachments-in-export gap is resolved.
