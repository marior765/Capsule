import type { Href } from "expo-router";

/**
 * The slice of expo-router's `router` that leaving a screen needs — typed
 * structurally so callers pass the real `router` and tests a plain object.
 */
export type ScreenRouter = {
  canDismiss: () => boolean;
  dismiss: () => void;
  replace: (href: Href) => void;
};

/**
 * Leaves the current screen for the one beneath it in the same stack.
 *
 * `router.replace(<previous screen's route>)` looks equivalent but isn't: it
 * swaps this screen for a NEW copy of that route, leaving the original
 * underneath — Back then lands on a stale duplicate.
 *
 * `canGoBack()`/`back()` aren't used either: they look past this stack into
 * the tab navigator, so a screen pushed alone into another tab's stack (a
 * capsule opened from chat or a notification) would "go back" to a
 * different tab and stay mounted where it was. `canDismiss()`/`dismiss()`
 * only consider the current stack; when this screen is that stack's root,
 * it's replaced with `fallback` instead.
 */
export function leaveScreen(router: ScreenRouter, fallback: Href): void {
  if (router.canDismiss()) {
    router.dismiss();
  } else {
    router.replace(fallback);
  }
}

/** The slice of expo-router's `router` that `openRoute` needs. */
export type OpeningRouter = {
  push: (href: Href, options?: { withAnchor?: boolean }) => void;
  dismissTo: (href: Href, options?: { withAnchor?: boolean }) => void;
};

/**
 * Opens `href` from wherever the user currently is, given the current
 * `useSegments()`.
 *
 * Secondary screens sit on an outer stack above the tabs. From one of them,
 * `push` to a tab route would mount a second tab navigator, so `dismissTo`
 * pops back to the existing tabs instead. From inside the tabs it's the
 * other way round — `dismissTo` there is a POP_TO the tab navigator ignores
 * (the open silently does nothing), while `push` works.
 */
export function openRoute(
  router: OpeningRouter,
  segments: readonly string[],
  href: Href,
): void {
  // withAnchor: a tab not visited yet gets its list screen (its stack's
  // `unstable_settings.anchor`) beneath the opened screen — a back button.
  if (segments.includes("(tabs)")) {
    router.push(href, { withAnchor: true });
  } else {
    router.dismissTo(href, { withAnchor: true });
  }
}
