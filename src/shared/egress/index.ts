/**
 * Tracks whether the app is currently making a network call, purely so a
 * "verifiable privacy" UI (widgets/PrivacyBanner) can show a live signal.
 * No domain knowledge — callers wrap their own network calls with
 * `beginEgress()`/the ender it returns; this module doesn't know or care
 * what kind of call it is. Distinct from `entities/audit`, which records
 * that a network action *happened*; this reflects that one is happening
 * *right now*. Same subscribe/notify shape as features/app-lock's
 * `createAppLock`, kept here as a shared primitive since egress tracking
 * has no domain-specific state of its own.
 */

export type EgressListener = (active: boolean) => void;

let activeCount = 0;
let lastNotifiedActive = false;
const listeners = new Set<EgressListener>();

export function isEgressActive(): boolean {
  return activeCount > 0;
}

export function subscribeToEgress(listener: EgressListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Only notifies on an actual true<->false transition — going from, say, two
// overlapping calls down to one is still "active" both before and after,
// and a UI subscribed to this shouldn't have to de-duplicate a notification
// that carries no new information.
function notify(): void {
  const active = isEgressActive();
  if (active === lastNotifiedActive) {
    return;
  }
  lastNotifiedActive = active;
  for (const listener of listeners) {
    listener(active);
  }
}

/**
 * Marks a network call as started. Returns an idempotent ender — call it
 * once the call finishes (success or failure); calling it more than once
 * is safe and only decrements the count the first time. Egress stays
 * "active" as long as any overlapping call hasn't ended yet.
 */
export function beginEgress(): () => void {
  activeCount += 1;
  notify();

  let ended = false;
  return () => {
    if (ended) {
      return;
    }
    ended = true;
    activeCount -= 1;
    notify();
  };
}

export function _resetEgressForTesting(): void {
  activeCount = 0;
  lastNotifiedActive = false;
  listeners.clear();
}
