import { router, Stack, useSegments } from "expo-router";
import { useEffect, useRef } from "react";
import { capsuleIdFromNotification } from "@/features/manage-reminders";
import { openRoute } from "@/shared/navigation";
import { onNotificationTapped } from "@/shared/notifications";

/** A deep link to a secondary screen still opens with the tabs beneath it. */
export const unstable_settings = {
  initialRouteName: "(tabs)",
};

/**
 * The tabs sit in a header-less `(tabs)` group at the bottom of this stack;
 * secondary screens are pushed on top of them. Pushing (rather than hiding
 * them inside the tab navigator) is what gives them a header and a back
 * button that returns to the tab they were opened from.
 */
export default function AppLayout() {
  // Tapping a reminder notification opens its capsule (8.11). Mounted here —
  // after the lock gate and once navigation exists — so a tap never gets
  // past the lock screen; the launch tap waits for the unlock too. The
  // handler is subscribed once, so it reads where the user is from a ref.
  const segments = useSegments();
  const segmentsRef = useRef<readonly string[]>(segments);
  useEffect(() => {
    segmentsRef.current = segments;
  }, [segments]);
  useEffect(
    () =>
      onNotificationTapped((data) => {
        const capsuleId = capsuleIdFromNotification(data);
        if (capsuleId !== null) {
          openRoute(router, segmentsRef.current, `/capsules/${capsuleId}`);
        }
      }),
    [],
  );

  return (
    // Chevron-only back buttons: the default label is the previous route's
    // name, which for the tabs is the "(tabs)" folder name.
    <Stack screenOptions={{ headerBackButtonDisplayMode: "minimal" }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="search" options={{ headerShown: false }} />
      <Stack.Screen name="models/index" options={{ title: "Models" }} />
      <Stack.Screen name="personas/index" options={{ title: "Personas" }} />
      <Stack.Screen name="snippets/index" options={{ title: "Snippets" }} />
      <Stack.Screen name="types/index" options={{ title: "Capsule types" }} />
      <Stack.Screen name="types/new" options={{ title: "New type" }} />
      <Stack.Screen name="types/[id]" options={{ title: "Capsule type" }} />
    </Stack>
  );
}
