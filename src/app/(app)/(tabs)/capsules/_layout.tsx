import { Stack } from "expo-router";

// Every screen gets a human title — a Stack otherwise shows the route name
// ("index", "[id]", "[id]/edit"). Back buttons are chevron-only for the same
// reason.
export default function CapsulesLayout() {
  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: "minimal" }}>
      <Stack.Screen name="index" options={{ title: "Capsules" }} />
      <Stack.Screen name="new" options={{ title: "New capsule" }} />
      <Stack.Screen name="[id]" options={{ title: "Capsule" }} />
      <Stack.Screen name="[id]/edit" options={{ title: "Edit capsule" }} />
    </Stack>
  );
}
