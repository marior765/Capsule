// Mock for expo-notifications — tests never touch the OS notification system.

let counter = 0;
export const __scheduled = new Map<
  string,
  { title: string; body: string; date: number }
>();
export const __permission = { granted: true, canAskAgain: true, prompted: 0 };

export function __resetNotificationsMock(): void {
  counter = 0;
  __scheduled.clear();
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
    content: { title: string; body: string };
    trigger: { type: string; date: Date | number };
  }): Promise<string> => {
    counter += 1;
    const id = `notif-${counter}`;
    __scheduled.set(id, {
      title: request.content.title,
      body: request.content.body,
      date: new Date(request.trigger.date).getTime(),
    });
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
