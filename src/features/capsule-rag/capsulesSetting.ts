/**
 * The chat's "Capsules" switch (7.3, 10.18). It can only be on while the
 * capsule-search model is downloaded — otherwise nothing can ground replies,
 * so turning it on is refused and the caller says the model is needed.
 */
export function toggleCapsules(
  current: boolean,
  hasModel: boolean,
): { enabled: boolean; needsModel: boolean } {
  if (current) return { enabled: false, needsModel: false };
  return hasModel
    ? { enabled: true, needsModel: false }
    : { enabled: false, needsModel: true };
}

/** Whether capsules actually ground replies: chosen, and the model is there. */
export function capsulesInUse(chosen: boolean, hasModel: boolean): boolean {
  return chosen && hasModel;
}
