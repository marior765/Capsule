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
