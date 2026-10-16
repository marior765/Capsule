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
