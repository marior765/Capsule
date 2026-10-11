// Tests for 8.8 (shared/notifications wrapper) — written before implementation (TDD)
import {
  __permission,
  __resetNotificationsMock,
  __scheduled,
  cancelScheduledNotificationAsync,
  requestPermissionsAsync,
  setNotificationHandler,
  __scheduledData,
  __tapNotification,
  __launchedFromNotification,
} from "@/__mocks__/expo-notifications";
import {
  cancelAllLocalNotifications,
  cancelLocalNotification,
  configureNotificationDisplay,
  ensureNotificationPermission,
  scheduleLocalNotification,
  onNotificationTapped,
} from "../index";

beforeEach(() => __resetNotificationsMock());

describe("ensureNotificationPermission", () => {
  it("returns true without prompting when already granted", async () => {
    await expect(ensureNotificationPermission()).resolves.toBe(true);
    expect(requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it("prompts once when not yet granted, and reports the answer", async () => {
    __permission.granted = false;
    await expect(ensureNotificationPermission()).resolves.toBe(false);
    expect(__permission.prompted).toBe(1);
  });

  it("doesn't prompt when the OS says it can't ask again", async () => {
    __permission.granted = false;
    __permission.canAskAgain = false;
    await expect(ensureNotificationPermission()).resolves.toBe(false);
    expect(requestPermissionsAsync).not.toHaveBeenCalled();
  });
});

describe("scheduleLocalNotification", () => {
  it("schedules a one-off local notification at the given time and returns its id", async () => {
    const id = await scheduleLocalNotification({
      at: 5_000_000,
      title: "Reminder",
      body: "Dentist",
    });
    expect(__scheduled.get(id)).toEqual({
      title: "Reminder",
      body: "Dentist",
      date: 5_000_000,
    });
  });
});

describe("cancelling", () => {
  it("cancels one notification", async () => {
    const id = await scheduleLocalNotification({
      at: 1,
      title: "t",
      body: "b",
    });
    await cancelLocalNotification(id);
    expect(__scheduled.has(id)).toBe(false);
  });

  it("never throws when the OS can't cancel (e.g. it already fired)", async () => {
    cancelScheduledNotificationAsync.mockRejectedValueOnce(new Error("gone"));
    await expect(cancelLocalNotification("x")).resolves.toBeUndefined();
  });

  it("cancels everything", async () => {
    await scheduleLocalNotification({ at: 1, title: "a", body: "a" });
    await scheduleLocalNotification({ at: 2, title: "b", body: "b" });
    await cancelAllLocalNotifications();
    expect(__scheduled.size).toBe(0);
  });
});

describe("configureNotificationDisplay", () => {
  it("installs a handler so reminders also show while the app is open", () => {
    configureNotificationDisplay();
    expect(setNotificationHandler).toHaveBeenCalledWith(
      expect.objectContaining({ handleNotification: expect.any(Function) }),
    );
  });
});

// 8.11: notifications carry data; tapping one reaches the app.
describe("notification data and taps (8.11)", () => {
  it("attaches data to a scheduled notification", async () => {
    const id = await scheduleLocalNotification({
      at: Date.now() + 60_000,
      title: "Reminder",
      body: "b",
      data: { capsuleId: "c1" },
    });
    expect(__scheduledData.get(id)).toEqual({ capsuleId: "c1" });
  });

  it("calls the handler with a tapped notification's data, until unsubscribed", async () => {
    const handler = jest.fn();
    const stop = onNotificationTapped(handler);
    __tapNotification({ capsuleId: "c1" });
    stop();
    __tapNotification({ capsuleId: "c2" });
    expect(handler.mock.calls).toEqual([[{ capsuleId: "c1" }]]);
  });

  it("also delivers the tap that launched the app — once", async () => {
    __launchedFromNotification({ capsuleId: "c9" });
    const first = jest.fn();
    onNotificationTapped(first);
    await new Promise((r) => setTimeout(r, 0));
    expect(first).toHaveBeenCalledWith({ capsuleId: "c9" });

    const second = jest.fn();
    onNotificationTapped(second);
    await new Promise((r) => setTimeout(r, 0));
    expect(second).not.toHaveBeenCalled();
  });
});

it("doesn't replay a tap already handled live when something subscribes later (8.11)", async () => {
  const first = jest.fn();
  const stop = onNotificationTapped(first);
  __tapNotification({ capsuleId: "c1" });
  stop();
  const later = jest.fn();
  onNotificationTapped(later);
  await new Promise((r) => setTimeout(r, 0));
  expect(first).toHaveBeenCalledTimes(1);
  expect(later).not.toHaveBeenCalled();
});
