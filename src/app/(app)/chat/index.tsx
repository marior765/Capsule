import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useDb } from "@/app/providers";
import type { Conversation } from "@/entities/conversation";
import { listConversations } from "@/features/manage-conversations";

export default function ChatListScreen() {
  const db = useDb();
  const [conversations, setConversations] = useState<Conversation[]>([]);

  useFocusEffect(
    useCallback(() => {
      setConversations(listConversations(db));
    }, [db])
  );

  return (
    <View style={styles.root}>
      <Pressable style={styles.newButton} onPress={() => router.push("/chat/new")}>
        <Text style={styles.newLabel}>New chat</Text>
      </Pressable>
      <FlatList
        data={conversations}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => router.push(`/chat/${item.id}`)}
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
  newButton: {
    paddingVertical: theme.spacing.three,
    alignItems: "center",
    borderRadius: theme.spacing.two,
    backgroundColor: theme.colors.backgroundSelected,
    marginBottom: theme.spacing.three,
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
