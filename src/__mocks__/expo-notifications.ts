// Mock for expo-notifications — tests never touch the OS notification system.

let counter = 0;
export const __scheduled = new Map<
  string,
  { title: string; body: string; date: number }
>();
export const __permission = { granted: true, canAskAgain: true, prompted: 0 };
/** Each scheduled notification's `content.data` (8.11), kept apart from `__scheduled`. */
export const __scheduledData = new Map<string, Record<string, unknown>>();

type Response = {
  notification: { request: { content: { data: Record<string, unknown> } } };
};
const responseListeners = new Set<(r: Response) => void>();
let lastResponse: Response | null = null;
const responseFor = (data: Record<string, unknown>): Response => ({
  notification: { request: { content: { data } } },
});

/** Simulates the user tapping a notification while the app runs. */
export function __tapNotification(data: Record<string, unknown>): void {
  lastResponse = responseFor(data);
  responseListeners.forEach((listener) => listener(lastResponse!));
}

/** Simulates the app having been launched by tapping a notification. */
export function __launchedFromNotification(
  data: Record<string, unknown>,
): void {
  lastResponse = responseFor(data);
}

export function __resetNotificationsMock(): void {
  counter = 0;
  __scheduled.clear();
  __scheduledData.clear();
  responseListeners.clear();
  lastResponse = null;
  __permission.granted = true;
  __permission.canAskAgain = true;
  __permission.prompted = 0;
  jest.clearAllMocks();
}

export enum SchedulableTriggerInputTypes {
  DATE = "date",
}

export const getPermissionsAsync = jest.fn(async () => ({
  granted: __permission.granted,
  canAskAgain: __permission.canAskAgain,
}));

export const requestPermissionsAsync = jest.fn(async () => {
  __permission.prompted += 1;
  return { granted: __permission.granted, canAskAgain: false };
});

export const scheduleNotificationAsync = jest.fn(
  async (request: {
    content: { title: string; body: string; data?: Record<string, unknown> };
    trigger: { type: string; date: Date | number };
  }): Promise<string> => {
    counter += 1;
    const id = `notif-${counter}`;
    __scheduled.set(id, {
      title: request.content.title,
      body: request.content.body,
      date: new Date(request.trigger.date).getTime(),
    });
    if (request.content.data) __scheduledData.set(id, request.content.data);
    return id;
  },
);

export const cancelScheduledNotificationAsync = jest.fn(async (id: string) => {
  __scheduled.delete(id);
});

export const cancelAllScheduledNotificationsAsync = jest.fn(async () => {
  __scheduled.clear();
});

export const setNotificationHandler = jest.fn();

export const addNotificationResponseReceivedListener = jest.fn(
  (listener: (r: Response) => void) => {
    responseListeners.add(listener);
    return { remove: () => responseListeners.delete(listener) };
  },
);

export const getLastNotificationResponseAsync = jest.fn(
  async () => lastResponse,
);

export const getLastNotificationResponse = jest.fn(() => lastResponse);

export const clearLastNotificationResponse = jest.fn(() => {
  lastResponse = null;
});
