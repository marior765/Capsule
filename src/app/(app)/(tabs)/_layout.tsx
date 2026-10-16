import { SymbolView, type AndroidSymbol, type SFSymbol } from "expo-symbols";
import { Tabs } from "expo-router";
import type { ColorValue } from "react-native";

type TabSymbol = { ios: SFSymbol; android: AndroidSymbol };
type TabIconProps = { color: ColorValue; size: number; focused: boolean };

/**
 * One symbol per tab: SF Symbols on iOS (filled when the tab is focused, the
 * iOS convention), Material Symbols on Android — both via expo-symbols.
 */
function tabIcon(outline: TabSymbol, filled: TabSymbol) {
  return function TabIcon({ color, size, focused }: TabIconProps) {
    const symbol = focused ? filled : outline;
    return (
      <SymbolView
        name={{ ios: symbol.ios, android: symbol.android }}
        tintColor={color}
        size={size}
      />
    );
  };
}

/**
 * The four primary tabs. Secondary screens (models, personas, snippets,
 * capsule types, search) are NOT tabs — they're pushed on the outer stack in
 * `(app)/_layout.tsx`, so they get a header with a back button that returns
 * to whichever tab opened them.
 */
export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: tabIcon(
            { ios: "house", android: "home" },
            { ios: "house.fill", android: "home" },
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "Chat",
          tabBarIcon: tabIcon(
            { ios: "bubble.left.and.bubble.right", android: "forum" },
            { ios: "bubble.left.and.bubble.right.fill", android: "forum" },
          ),
        }}
      />
      <Tabs.Screen
        name="capsules"
        options={{
          title: "Capsules",
          tabBarIcon: tabIcon(
            { ios: "square.stack.3d.up", android: "stacks" },
            { ios: "square.stack.3d.up.fill", android: "stacks" },
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: tabIcon(
            { ios: "gearshape", android: "settings" },
            { ios: "gearshape.fill", android: "settings" },
          ),
        }}
      />
    </Tabs>
  );
}
