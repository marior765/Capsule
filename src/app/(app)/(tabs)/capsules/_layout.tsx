import { router, Stack } from "expo-router";
import { Pressable, Text } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { createComponentTestIDs } from "@/shared/testing";

/** The Capsules list's "New" header button — the full creation form. */
function NewCapsuleButton() {
  return (
    <Pressable
      testID={testIDs.buttons.newCapsule}
      onPress={() => router.push("/capsules/new")}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="New capsule"
    >
      <Text style={styles.headerButton}>New</Text>
    </Pressable>
  );
}

// Every screen gets a human title — a Stack otherwise shows the route name
// ("index", "[id]", "[id]/edit"). Back buttons are chevron-only for the same
// reason.
export default function CapsulesLayout() {
  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: "minimal" }}>
      <Stack.Screen
        name="index"
        options={{ title: "Capsules", headerRight: NewCapsuleButton }}
      />
      <Stack.Screen name="new" options={{ title: "New capsule" }} />
      <Stack.Screen name="[id]" options={{ title: "Capsule" }} />
      <Stack.Screen name="[id]/edit" options={{ title: "Edit capsule" }} />
    </Stack>
  );
}

const styles = StyleSheet.create((theme) => ({
  headerButton: {
    color: theme.colors.accent,
    fontFamily: theme.fonts.sans,
    fontSize: 17,
  },
}));

const testIDs = createComponentTestIDs("CapsulesLayout", {
  buttons: ["newCapsule"] as const,
});

CapsulesLayout.testIDs = testIDs;
