import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useDb, useLlm } from "@/app/providers";
import { RECOMMENDED_MODELS } from "@/shared/config";
import type { Model } from "@/entities/model";
import {
  deleteModelById,
  downloadModel,
  listModels,
  selectModel,
} from "@/features/manage-models";

type ModelSpec = (typeof RECOMMENDED_MODELS)[number];

export default function ModelsScreen() {
  const db = useDb();
  const { activeModel, reload } = useLlm();
  const [models, setModels] = useState<Model[]>([]);
  const [downloadingUrl, setDownloadingUrl] = useState<string | null>(null);

  const refresh = useCallback(() => setModels(listModels(db)), [db]);
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const handleSelect = (model: Model) => {
    selectModel(db, model.id);
    reload();
    refresh();
  };

  const handleDelete = async (model: Model) => {
    await deleteModelById(db, model.id);
    reload();
    refresh();
  };

  const handleDownload = async (spec: ModelSpec) => {
    setDownloadingUrl(spec.url);
    try {
      await downloadModel(db, spec);
    } finally {
      setDownloadingUrl(null);
      refresh();
    }
  };

  const downloadedNames = new Set(models.map((m) => m.name));
  const available = RECOMMENDED_MODELS.filter(
    (s) => !downloadedNames.has(s.name)
  );

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Your models</Text>
      {models.length === 0 && (
        <Text style={styles.muted}>No models downloaded yet.</Text>
      )}
      {models.map((model) => {
        const isActive = model.id === activeModel?.id;
        return (
          <View key={model.id} style={styles.row}>
            <Pressable
              style={styles.rowMain}
              onPress={() => handleSelect(model)}
            >
              <Text style={styles.name}>{model.name}</Text>
              <Text style={styles.meta}>
                {isActive ? "Active" : "Tap to use"} · {model.parameters} ·{" "}
                {model.quantization}
              </Text>
            </Pressable>
            <Pressable onPress={() => handleDelete(model)}>
              <Text style={styles.delete}>Delete</Text>
            </Pressable>
          </View>
        );
      })}

      <Text style={styles.heading}>Download</Text>
      {available.length === 0 && (
        <Text style={styles.muted}>All recommended models downloaded.</Text>
      )}
      {available.map((spec) => (
        <Pressable
          key={spec.url}
          style={styles.row}
          disabled={downloadingUrl !== null}
          onPress={() => handleDownload(spec)}
        >
          <View style={styles.rowMain}>
            <Text style={styles.name}>
              {downloadingUrl === spec.url ? "Downloading…" : spec.name}
            </Text>
            <Text style={styles.meta}>
              {spec.parameters} · {spec.quantization}
            </Text>
          </View>
        </Pressable>
      ))}
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
    marginTop: theme.spacing.three,
    marginBottom: theme.spacing.two,
  },
  muted: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.sans,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.colors.backgroundElement,
    padding: theme.spacing.three,
    borderRadius: theme.spacing.two,
    marginBottom: theme.spacing.two,
  },
  rowMain: {
    flex: 1,
  },
  name: {
    color: theme.colors.text,
    fontFamily: theme.fonts.sans,
  },
  meta: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.sans,
  },
  delete: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.rounded,
    paddingLeft: theme.spacing.three,
  },
}));
