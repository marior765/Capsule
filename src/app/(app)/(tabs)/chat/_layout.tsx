import { Stack } from "expo-router";

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
