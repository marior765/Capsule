# Human Gate Queue

Work the loop finished in code but **cannot prove**, plus decisions it refuses to
make unattended. This is where intent and accountability come back to you.

Nothing here has a ticked box in `docs/DEVELOPMENT_PLAN.md`. Mocked-green is not
hardware-green — ticking these off is yours to do, after verifying on a device.

## How to clear an item

1. Run the stated check on a real device or dev build.
2. Passes → tick the box in `docs/DEVELOPMENT_PLAN.md`, delete the item here.
3. Fails → move it to "Failed verification" below with the error. The next beat
   picks it up as real work with the failure as its starting signature.

---

## Needs a device / dev build

_(none yet — populated as the loop implements `class: native` steps)_

## Needs a decision from you

### 1.6.1 — ChatBubble markdown rendering
Requires adding `react-native-markdown-display` and `expo-clipboard`. Per
`CLAUDE.md`, dependencies must be audited for outbound requests before adding —
the loop will not install packages unattended.
**You decide:** approve both deps (and confirm the audit), or keep 1.6.1 deferred.

### Pre-existing uncommitted work
The working tree at bootstrap held a large staged change from earlier sessions
spanning routes, settings screens, and several new slices. It predates the loop
and was never reviewed or committed.
**You decide:** review and commit it yourself, or let beat 1 gate it (tsc + jest +
eslint + reviewer) and commit it as a single "pre-loop baseline" checkpoint.

## Failed verification

_(none)_
