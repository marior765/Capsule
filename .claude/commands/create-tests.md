Write tests for: $ARGUMENTS

## Parse arguments
- First argument: step number (e.g. `1.1`, `0.2`, `1.4`)
- Second argument: coverage depth — `light`, `medium`, or `hard`

Coverage depth definitions:
- **light** — happy path + edge cases
- **medium** — happy path + edge cases + error handling
- **hard** — happy path + edge cases + error handling + constraint violations + impossible/boundary cases

## Steps

1. Read `docs/DEVELOPMENT_PLAN.md` and find the step matching the number.
2. Read `docs/ARCHITECTURE.md` to understand which slice/layer this step belongs to.
3. Read any existing code in the relevant slice if it already exists.
4. Write tests at the specified coverage depth.

## Test rules
- Place tests in `src/<layer>/<slice>/__tests__/` mirroring the slice structure
- Use Jest + TypeScript
- No mocking of the module under test — test real behavior
- Mock only external dependencies (native modules, filesystem, network)
- Each test file covers one unit (one entity, one function, one wrapper)
- Test file name mirrors the source file: `db.ts` → `db.test.ts`
- Tests must be **failing or skipped** when written — do not implement the feature to make them pass
- Add a comment at the top of each test file: `// Tests for step X.Y — written before implementation (TDD)`
- **Widgets and routes can be rendered** (since 10.38): use `@testing-library/react-native` 14
  (`await render(...)`, `userEvent.setup()` + `await user.press/type(...)`), name the file
  `<Component>.render.test.tsx`, and query by the component's `testIDs` object or by role/label.
  Unistyles is mocked globally (its official mock plus `src/__mocks__/unistyles.setup.ts`, which
  registers the app's real themes), so no per-test unistyles mock is needed.
  Example: `src/widgets/ChatInput/__tests__/ChatInput.render.test.tsx`.

## Output
- Write the test files
- Print a summary: which file(s) were created, how many test cases, which coverage categories were included
- Confirm tests are currently failing (expected — implementation doesn't exist yet)
