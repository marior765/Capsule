import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useDb } from "@/app/providers";
import type { Conversation } from "@/entities/conversation";
import { listConversations } from "@/features/manage-conversations";
import { createComponentTestIDs } from "@/shared/testing";

export default function ChatListScreen() {
  const db = useDb();
  const [conversations, setConversations] = useState<Conversation[]>([]);

  useFocusEffect(
    useCallback(() => {
      setConversations(listConversations(db));
    }, [db]),
  );

  return (
    <View style={styles.root}>
      <View style={styles.actions}>
        <Pressable
          testID={testIDs.buttons.newChat}
          style={styles.actionButton}
          onPress={() => router.push("/chat/new")}
          accessibilityRole="button"
        >
          <Text style={styles.newLabel}>New chat</Text>
        </Pressable>
        <Pressable
          testID={testIDs.buttons.ephemeral}
          style={styles.actionButton}
          onPress={() => router.push("/chat/ephemeral")}
          accessibilityRole="button"
        >
          <Text style={styles.newLabel}>Ephemeral</Text>
        </Pressable>
        <Pressable
          testID={testIDs.buttons.models}
          style={styles.actionButton}
          onPress={() => router.push("/models")}
          accessibilityRole="button"
        >
          <Text style={styles.newLabel}>Models</Text>
        </Pressable>
      </View>
      <FlatList
        data={conversations}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => (
          <Pressable
            testID={`${testIDs.pressables.conversation}_${item.id}`}
            style={styles.row}
            onPress={() => router.push(`/chat/${item.id}`)}
            accessibilityRole="button"
            accessibilityLabel={item.title}
          >
            <Text style={styles.title}>{item.title}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.three,
  },
  actions: {
    flexDirection: "row",
    gap: theme.spacing.two,
    marginBottom: theme.spacing.three,
  },
  actionButton: {
    flex: 1,
    paddingVertical: theme.spacing.three,
    alignItems: "center",
    borderRadius: theme.spacing.two,
    backgroundColor: theme.colors.backgroundSelected,
  },
  newLabel: {
    color: theme.colors.text,
    fontFamily: theme.fonts.rounded,
  },
  row: {
    paddingVertical: theme.spacing.three,
    borderRadius: theme.spacing.two,
    backgroundColor: theme.colors.backgroundElement,
    paddingHorizontal: theme.spacing.three,
    marginBottom: theme.spacing.two,
  },
  title: {
    color: theme.colors.text,
    fontFamily: theme.fonts.sans,
  },
}));

const testIDs = createComponentTestIDs("ChatListScreen", {
  buttons: ["newChat", "ephemeral", "models"] as const,
  pressables: ["conversation"] as const,
});

ChatListScreen.testIDs = testIDs;
