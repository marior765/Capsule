import {
  addNotificationResponseReceivedListener,
  cancelAllScheduledNotificationsAsync,
  clearLastNotificationResponse,
  getLastNotificationResponse,
  cancelScheduledNotificationAsync,
  getPermissionsAsync,
  requestPermissionsAsync,
  scheduleNotificationAsync,
  SchedulableTriggerInputTypes,
  setNotificationHandler,
} from "expo-notifications";

/**
 * `shared/notifications` — the only place that calls `expo-notifications`
 * (same principle as `shared/llm` owning llama.rn). LOCAL notifications
 * only: everything is scheduled on the device by the OS; no push token is
 * ever requested and nothing is sent anywhere. The expo-notifications
 * config plugin is deliberately not added to app.json — it would add an
 * iOS push entitlement this app doesn't need (see `.claude/loop/BLOCKED.md`,
 * 8.8).
 */

/**
 * True if the app may show notifications. Asks the OS once if it hasn't
 * been asked yet (call this from an explicit user action, e.g. creating a
 * reminder); never prompts when the OS says it can't ask again.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const requested = await requestPermissionsAsync();
  return requested.granted;
}

/** Schedules a one-off local notification at `at` (epoch ms). Returns its id. */
export async function scheduleLocalNotification(params: {
  at: number;
  title: string;
  body: string;
  /** Small app data carried with it, e.g. which capsule to open on tap. */
  data?: Record<string, string>;
}): Promise<string> {
  return scheduleNotificationAsync({
    content: {
      title: params.title,
      body: params.body,
      ...(params.data ? { data: params.data } : {}),
    },
    trigger: { type: SchedulableTriggerInputTypes.DATE, date: params.at },
  });
}

/** Cancels one scheduled notification. Never throws — a notification that already fired or was cleared is fine. */
export async function cancelLocalNotification(id: string): Promise<void> {
  try {
    await cancelScheduledNotificationAsync(id);
  } catch {
    // nothing left to cancel
  }
}

/** Cancels every scheduled notification (the full wipe). */
export async function cancelAllLocalNotifications(): Promise<void> {
  await cancelAllScheduledNotificationsAsync();
}

/** Makes reminders show as a banner even while the app is open. Call once at startup. */
export function configureNotificationDisplay(): void {
  setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Calls `handler` with a notification's data when the user taps it (8.11) —
 * while the app is running, and also once for the tap that launched the
 * app (that one is then cleared, so it isn't handled twice). Mount this
 * only where acting on it is allowed (after unlock). Returns unsubscribe.
 */
export function onNotificationTapped(
  handler: (data: Record<string, unknown>) => void,
): () => void {
  // Native code keeps every tap as the "last response" — clear it once
  // handled, live or at launch, so a later subscriber never replays it.
  const handle = (data: Record<string, unknown> | undefined) => {
    clearLastNotificationResponse();
    handler(data ?? {});
  };
  const subscription = addNotificationResponseReceivedListener((response) =>
    handle(response.notification.request.content.data),
  );
  try {
    const launch = getLastNotificationResponse();
    if (launch !== null) handle(launch.notification.request.content.data);
  } catch {
    // no launch tap to handle
  }
  return () => subscription.remove();
}
