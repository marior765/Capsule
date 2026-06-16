Before writing any code, produce an implementation plan for: $ARGUMENTS

## Steps

1. Read `docs/DEVELOPMENT_PLAN.md` to understand the step scope.
2. Read `docs/ARCHITECTURE.md` to identify which slices are involved.
3. Read all existing files in the relevant slices.
4. Identify every file that needs to be created or modified.

## Output format

```
## Plan: <step name>

**Files to create:**
- path/to/file.ts — what it does

**Files to modify:**
- path/to/file.ts — what changes and why

**Key decisions:**
- Decision made and why (alternatives considered if relevant)

**Risks / things to verify:**
- Anything that could go wrong or needs your input

**Proposed implementation order:**
1. Step one
2. Step two
...
```

## Rules
- Do NOT write, edit, or create any code files during this command.
- Do NOT run any shell commands.
- Read only.
- End with: "Approve to proceed, or let me know what to change."
