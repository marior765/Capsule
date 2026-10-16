import { Stack } from "expo-router";

// Every screen gets a human title — a Stack otherwise shows the route name
// ("index", "inference", "import-export"). Back buttons are chevron-only for
// the same reason.
export default function SettingsLayout() {
  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: "minimal" }}>
      <Stack.Screen name="index" options={{ title: "Settings" }} />
      <Stack.Screen name="inference" options={{ title: "Inference" }} />
      <Stack.Screen name="privacy" options={{ title: "Privacy" }} />
      <Stack.Screen
        name="import-export"
        options={{ title: "Import & Export" }}
      />
      <Stack.Screen name="storage" options={{ title: "Storage" }} />
      <Stack.Screen name="appearance" options={{ title: "Appearance" }} />
      <Stack.Screen name="sync" options={{ title: "Sync" }} />
    </Stack>
  );
}
