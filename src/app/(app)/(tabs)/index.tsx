import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet } from "react-native-unistyles";
import { useDb } from "@/app/providers";
import {
  getRecentActivity,
  type RecentActivity,
} from "@/features/home-overview";
import { createComponentTestIDs } from "@/shared/testing";

const EMPTY: RecentActivity = { capsules: [], conversations: [] };

/**
 * The Home tab: the search/jump-to trigger, then whatever was touched most
 * recently — capsules and conversations. Refreshed every time Home is shown,
 * so an edit made elsewhere is reflected on return. The tab has no navigator
 * header, so the content insets itself below the status bar.
 */
export default function HomeScreen() {
  const db = useDb();
  const [recent, setRecent] = useState<RecentActivity>(EMPTY);

  useFocusEffect(
    useCallback(() => {
      setRecent(getRecentActivity(db));
    }, [db]),
  );

  return (
    <SafeAreaView
      testID={testIDs.containers.root}
      style={styles.root}
      edges={["top"]}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <Text style={styles.heading} accessibilityRole="header">
          Capsule
        </Text>
        <Pressable
          testID={testIDs.pressables.openSearch}
          style={styles.searchTrigger}
          onPress={() => router.push("/search")}
          accessibilityRole="button"
          accessibilityLabel="Search or jump to"
        >
          <Text style={styles.searchTriggerLabel}>Search or jump to…</Text>
        </Pressable>

        <Text style={styles.sectionTitle} accessibilityRole="header">
          Recent capsules
        </Text>
        {recent.capsules.length === 0 ? (
          <Text style={styles.empty}>No capsules yet.</Text>
        ) : (
          recent.capsules.map((capsule) => (
            <Pressable
              key={capsule.id}
              testID={`${testIDs.pressables.capsule}_${capsule.id}`}
              style={styles.row}
              onPress={() => router.push(`/capsules/${capsule.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`${capsule.title}, capsule`}
            >
              <Text style={styles.rowLabel} numberOfLines={1}>
                {capsule.title}
              </Text>
            </Pressable>
          ))
        )}

        <Text style={styles.sectionTitle} accessibilityRole="header">
          Recent conversations
        </Text>
        {recent.conversations.length === 0 ? (
          <Text style={styles.empty}>No conversations yet.</Text>
        ) : (
          recent.conversations.map((conversation) => (
            <Pressable
              key={conversation.id}
              testID={`${testIDs.pressables.conversation}_${conversation.id}`}
              style={styles.row}
              onPress={() => router.push(`/chat/${conversation.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`${conversation.title}, conversation`}
            >
              <Text style={styles.rowLabel} numberOfLines={1}>
                {conversation.title}
              </Text>
            </Pressable>
          ))
        )}
        <View style={styles.bottomSpace} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing.three,
  },
  heading: {
    color: theme.colors.text,
    fontFamily: theme.fonts.rounded,
    fontSize: 28,
    marginBottom: theme.spacing.three,
  },
  searchTrigger: {
    backgroundColor: theme.colors.backgroundElement,
    borderRadius: theme.spacing.two,
    paddingHorizontal: theme.spacing.three,
    paddingVertical: theme.spacing.three,
  },
  searchTriggerLabel: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.sans,
    fontSize: 14,
  },
  sectionTitle: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.sans,
    fontSize: 13,
    marginTop: theme.spacing.four,
    marginBottom: theme.spacing.two,
  },
  row: {
    backgroundColor: theme.colors.backgroundElement,
    borderRadius: theme.spacing.two,
    paddingHorizontal: theme.spacing.three,
    paddingVertical: theme.spacing.three,
    marginBottom: theme.spacing.two,
  },
  rowLabel: {
    color: theme.colors.text,
    fontFamily: theme.fonts.sans,
    fontSize: 15,
  },
  empty: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.sans,
    fontSize: 14,
  },
  bottomSpace: {
    height: theme.spacing.three,
  },
}));

const testIDs = createComponentTestIDs("HomeScreen", {
  containers: ["root"] as const,
  pressables: ["openSearch", "capsule", "conversation"] as const,
});

HomeScreen.testIDs = testIDs;
