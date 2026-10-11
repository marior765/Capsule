import { router, Tabs } from "expo-router";
import { useEffect } from "react";
import { capsuleIdFromNotification } from "@/features/manage-reminders";
import { onNotificationTapped } from "@/shared/notifications";

export default function AppLayout() {
  // Tapping a reminder notification opens its capsule (8.11). Mounted here —
  // after the lock gate and once navigation exists — so a tap never gets
  // past the lock screen; the launch tap waits for the unlock too.
  useEffect(
    () =>
      onNotificationTapped((data) => {
        const capsuleId = capsuleIdFromNotification(data);
        if (capsuleId !== null) router.push(`/capsules/${capsuleId}`);
      }),
    [],
  );

  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="chat" options={{ title: "Chat" }} />
      <Tabs.Screen name="capsules" options={{ title: "Capsules" }} />
      <Tabs.Screen name="settings" options={{ title: "Settings" }} />
      <Tabs.Screen name="models" options={{ href: null }} />
      <Tabs.Screen name="personas" options={{ href: null }} />
      <Tabs.Screen name="snippets" options={{ href: null }} />
      <Tabs.Screen name="search" options={{ href: null }} />
      <Tabs.Screen name="types" options={{ href: null }} />
    </Tabs>
  );
}
