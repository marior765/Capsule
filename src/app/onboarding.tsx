import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useDb, useLlm } from "@/app/providers";
import { RECOMMENDED_MODELS } from "@/shared/config";
import { downloadModel, selectModel } from "@/features/manage-models";

type ModelSpec = (typeof RECOMMENDED_MODELS)[number];

export default function OnboardingScreen() {
  const db = useDb();
  const { reload } = useLlm();
  const [downloadingUrl, setDownloadingUrl] = useState<string | null>(null);

  const handleDownload = async (spec: ModelSpec) => {
    setDownloadingUrl(spec.url);
    try {
      const model = await downloadModel(db, spec);
      selectModel(db, model.id);
      reload();
      router.replace("/");
    } finally {
      setDownloadingUrl(null);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>Welcome to Capsule</Text>
      <Text style={styles.subtitle}>
        A fully private, offline AI assistant. Download a model to get started —
        everything runs on your device.
      </Text>

      {RECOMMENDED_MODELS.map((spec) => (
        <Pressable
          key={spec.url}
          style={styles.card}
          disabled={downloadingUrl !== null}
          onPress={() => handleDownload(spec)}
        >
          <Text style={styles.cardTitle}>
            {downloadingUrl === spec.url ? "Downloading…" : spec.name}
          </Text>
          <Text style={styles.cardMeta}>
            {spec.parameters} · {spec.quantization}
          </Text>
        </Pressable>
      ))}

      <Pressable onPress={() => router.replace("/")}>
        <Text style={styles.skip}>Skip for now</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create((theme) => ({
  content: {
    flexGrow: 1,
    justifyContent: "center",
    padding: theme.spacing.five,
    backgroundColor: theme.colors.background,
  },
  title: {
    color: theme.colors.text,
    fontFamily: theme.fonts.rounded,
    fontSize: 28,
    marginBottom: theme.spacing.three,
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.sans,
    marginBottom: theme.spacing.five,
  },
  card: {
    backgroundColor: theme.colors.backgroundElement,
    padding: theme.spacing.three,
    borderRadius: theme.spacing.two,
    marginBottom: theme.spacing.two,
  },
  cardTitle: {
    color: theme.colors.text,
    fontFamily: theme.fonts.sans,
  },
  cardMeta: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.sans,
  },
  skip: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.rounded,
    textAlign: "center",
    marginTop: theme.spacing.three,
  },
}));
