You are running a safe loop for: $ARGUMENTS

## Setup
Create `.claude/loop-audit.md` with this structure:
```
# Loop Audit
**Task:** $ARGUMENTS
**Started:** <timestamp>
**Status:** running

## Iterations
```

## Each iteration
Before doing work, append to `.claude/loop-audit.md`:
```
### Iteration N — <timestamp>
**Doing:** <what you're about to implement>
```

After doing work, append the result:
```
**Result:** pass ✅ / fail ❌
**Details:** <what was done, what passed/failed, what's next>
```

## Loop rules
- WHAT: implement the next unchecked task from $ARGUMENTS
- CHECK: run `npx tsc --noEmit` then `npx jest --passWithNoTests` — both must pass
- STOP: all tasks done and CHECK passes, OR 5 consecutive failures — then stop and report

## Teardown
When the loop ends (success or max attempts):
1. Append final summary to `.claude/loop-audit.md`:
```
## Result: done ✅ / stopped ❌
**Reason:** <why it stopped>
**Summary:** <what was completed>
```
2. Delete `.claude/loop-audit.md`
3. Report to the user what was completed and what (if anything) is still pending
