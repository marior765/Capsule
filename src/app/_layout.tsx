import { Stack } from "expo-router";
import { Providers } from "./providers";

export default function RootLayout() {
  return (
    <Providers>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(app)" />
        <Stack.Screen name="onboarding" />
      </Stack>
    </Providers>
  );
}
