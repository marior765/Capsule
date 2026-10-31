import { Stack } from "expo-router";

/**
 * A screen opened straight into this tab before it was visited (the
 * palette, a reminder notification) still gets the tab's list beneath it,
 * and so a back button. Navigation calls pass `withAnchor: true`.
 */
export const unstable_settings = {
  anchor: "index",
};

// Every screen gets a human title — a Stack otherwise shows the route name
// ("index", "[id]", "ephemeral"). Back buttons are chevron-only for the same
// reason.
export default function ChatLayout() {
  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: "minimal" }}>
      <Stack.Screen name="index" options={{ title: "Chats" }} />
      <Stack.Screen name="new" options={{ title: "New chat" }} />
      <Stack.Screen name="ephemeral" options={{ title: "Ephemeral chat" }} />
      <Stack.Screen name="[id]" options={{ title: "Chat" }} />
    </Stack>
  );
}
