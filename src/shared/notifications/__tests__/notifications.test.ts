// Tests for 8.8 (shared/notifications wrapper) — written before implementation (TDD)
import {
  __permission,
  __resetNotificationsMock,
  __scheduled,
  cancelScheduledNotificationAsync,
  requestPermissionsAsync,
  setNotificationHandler,
} from "@/__mocks__/expo-notifications";
import {
  cancelAllLocalNotifications,
  cancelLocalNotification,
  configureNotificationDisplay,
  ensureNotificationPermission,
  scheduleLocalNotification,
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
