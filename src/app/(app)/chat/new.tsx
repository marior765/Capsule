import { router } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";
import { useDb, useLlm } from "@/app/providers";
import { createConversation } from "@/features/manage-conversations";

export default function NewChatScreen() {
  const db = useDb();
  const { activeModel } = useLlm();

  useEffect(() => {
    const conversation = createConversation(db, {
      modelId: activeModel?.id ?? null,
    });
    router.replace(`/chat/${conversation.id}`);
    // Run once on mount — the new conversation id is captured immediately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <View />;
}
