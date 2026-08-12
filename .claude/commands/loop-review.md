Independently review the implementation of plan step: $ARGUMENTS

You are the **checker** in a maker-checker pair. A different agent wrote this code
and wrote its tests. Your job is not to appreciate it — it is to **refute** it.

## Inputs to gather

1. The step's text in `docs/DEVELOPMENT_PLAN.md`.
2. `git diff HEAD` (or the diff since the step's checkpoint sha, if given).
3. The rules in `CLAUDE.md` and `docs/ARCHITECTURE.md`.

Do not read the implementer's reasoning or notes. Judge the diff.

## What to attack, in priority order

1. **Do the tests prove anything?** The sharpest failure mode in this repo:
   a test that asserts a *mock* returned a value proves the library works, not
   that our code does. Ask of each test — *could this pass if our implementation
   were deleted and replaced by the mock?* If yes, it is not a test.
2. **Completeness.** Does the diff implement the whole step as written, or the
   easy half of it?
3. **Layer boundaries.** Cross-slice import that bypasses a public `index.ts`?
   A lower layer importing an upper one? `shared/` that knows a domain concept?
4. **Native wrappers.** Any llama.rn or whisper.rn usage outside `shared/llm`
   or `shared/stt`.
5. **Privacy.** Any network call in core logic. Any data leaving the device.
   Any privacy-sensitive action (export, decrypt, wipe, model download) that
   fails to write to the `audit` entity.
6. **Types.** Any `any`, implicit or explicit. Any silent type widening.
7. **testIDs.** Hardcoded testID strings inline instead of a
   `createComponentTestIDs` object; interactive elements with no testID at all.
8. **Dead scaffolding.** An `index.ts` that exports nothing real, presented as
   a completed slice.

## Verdict rules

- **Default to `fail` when uncertain.** A false `pass` ships a bug into an
  unattended run; a false `fail` costs one retry.
- Findings must be concrete: `file:line` plus what is wrong. "Could be cleaner"
  is not a finding.
- Do not fix anything. Do not edit files. Report only.

## Output

```
VERDICT: pass | fail

FINDINGS:
- path/to/file.ts:42 — <what is wrong and why it violates the step or the rules>

TESTS-PROVE-BEHAVIOR: yes | no — <which assertions would survive deleting the implementation>
```
