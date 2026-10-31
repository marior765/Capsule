# Phase 10: 10.35 + 10.33

The last two open Phase 10 steps, done in a cloud session using the safe-loop process: tests first, a green gate, an independent reviewer told to refute, one commit per step. 10.14 is still quarantined from earlier.

## 10.35 — Branch switcher counts only the conversation's own first messages (`7dff533`)
- **Cause:** the route counted siblings with `getChildren(db, null)`, which matched `parent_id IS NULL` in **every** conversation. With N chats, a new chat's first message showed `‹ N/N`, and ‹ could switch the active leaf to another chat's message.
- **Fix:**
  - `entities/message` gains `getSiblings(db, message)`, which filters by `conversation_id`.
  - `getChildren` now takes a non-null `parentId`, so the unscoped root query can't come back.
  - Sibling counting and the "walk down to the newest reply" logic moved out of the chat route into `features/branch-conversation` as `getBranchPosition` and `findSiblingBranchLeaf`, so they can be tested without rendering.
- **Tests:** 11 new tests on a real SQLite test DB. With the conversation filter removed, 6 of them fail.
- **Reviewer:** pass on attempt 1. It re-ran the tests with the fix reverted, and checked that no other code (export, import, lan-sync, backup) walks root messages without the conversation filter.

## 10.33 — Version restore clears fields that were empty in the snapshot (`f0f8609`)
- **Cause:** snapshots record only fields that have a value row, and restore only wrote back what the snapshot held. So a field filled after the snapshot kept its newer value.
- **Fix:** before writing the snapshot's values, `restoreCapsuleVersion` sets to null every non-empty current value that the version didn't record. It nulls the value (the same as the editor clearing a field) rather than deleting the row, so the portable format is unaffected.
- **Decision: fields added to the type after the snapshot are cleared too.**
  - A snapshot can't tell "existed but blank" from "didn't exist yet"; either way the field had no value then.
  - This matches `getVersionChanges`, which treats a field missing from a snapshot as empty. A test checks that the history diff shows nothing left over after a restore.
  - Nothing is lost: the safety snapshot taken before every restore keeps the cleared values.
  - This reverses an earlier 8.5 choice ("leave untouched"). That test was replaced.
  - The reasoning is written in the doc comment and in journal beat 127.
- **Tests:** 4 new tests (3 fail with the change reverted; the safety-snapshot round-trip is a regression guard).
- **Reviewer:** pass on attempt 1. Its two minor notes were fixed before the commit:
  - the "added to the type" test now really inserts a field row;
  - the comment now covers leftover values of fields that were removed from the type.

## Gate (after each step)
- `npx tsc --noEmit`: clean
- `npx jest --passWithNoTests`: 149 suites, 1705 tests, all passing
- `npx eslint src`: 0 errors (only the existing boundaries legacy-selector warning)

## Left for a human: simulator checks (`.claude/loop/BLOCKED.md`)
There is no iOS simulator in the cloud. Both steps have a tap-by-tap check in BLOCKED.md:
- **10.35:**
  1. With at least 2 chats, start a new chat; its first message must show no `‹ 1/N`.
  2. Edit the first message; it now shows `2/2`.
  3. Tap ‹ / ›; it must stay in the same chat.
- **10.33:**
  1. Restore a version from before a field was filled; the field is empty.
  2. Restore the safety entry; the value comes back.
  3. Repeat with a field newly added to the type.

## Bookkeeping
- Both boxes are ticked in `docs/DEVELOPMENT_PLAN.md`.
- `.claude/loop/state.json`: step entries added and the run marked complete.
- New entries in `journal.md` and in `docs/ARTICLE.md`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01TXUtg1yiMh5JAC5Pvf24af
