import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, Text } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useDb, useLlm } from "@/app/providers";
import { getAllPersonas, type Persona } from "@/entities/persona";
import { createConversation } from "@/features/manage-conversations";
import { PersonaSelector } from "@/widgets/PersonaSelector";

export default function NewChatScreen() {
  const db = useDb();
  const { activeModel } = useLlm();
  const [personas] = useState<Persona[]>(() => getAllPersonas(db));

  const start = (persona: Persona | null) => {
    const conversation = createConversation(db, {
      modelId: activeModel?.id ?? null,
      personaId: persona?.id ?? null,
      title: persona ? persona.name : undefined,
    });
    router.replace(`/chat/${conversation.id}`);
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Start a chat</Text>
      <Text style={styles.meta}>
        Pick a persona, or start without one. Tapping any option begins the
        chat.
      </Text>
      <PersonaSelector personas={personas} onSelect={start} allowNone />
    </ScrollView>
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
    marginBottom: theme.spacing.two,
  },
  meta: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.sans,
    fontSize: 12,
    marginBottom: theme.spacing.three,
  },
}));
