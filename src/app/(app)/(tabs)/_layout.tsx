import { Tabs } from "expo-router";

/**
 * The four primary tabs. Secondary screens (models, personas, snippets,
 * capsule types, search) are NOT tabs — they're pushed on the outer stack in
 * `(app)/_layout.tsx`, so they get a header with a back button that returns
 * to whichever tab opened them.
 */
export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="chat" options={{ title: "Chat" }} />
      <Tabs.Screen name="capsules" options={{ title: "Capsules" }} />
      <Tabs.Screen name="settings" options={{ title: "Settings" }} />
    </Tabs>
  );
}
