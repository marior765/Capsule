import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useDb, useEmbeddings, useLlm } from "@/app/providers";
import { RECOMMENDED_MODELS } from "@/shared/config";
import { getActiveModel, type Model } from "@/entities/model";
import {
  deleteModelById,
  downloadModel,
  listModels,
  selectModel,
} from "@/features/manage-models";
import {
  DEFAULT_EMBEDDING_MODEL,
  deleteEmbeddingModel,
  downloadEmbeddingModel,
  getEmbeddingModelUri,
  isEmbeddingModelDownloading,
  waitForEmbeddingDownload,
} from "@/features/manage-embedding-model";
import {
  EmbeddingModelCard,
  type EmbeddingModelState,
} from "@/widgets/EmbeddingModelCard";
import { createComponentTestIDs } from "@/shared/testing";

type ModelSpec = (typeof RECOMMENDED_MODELS)[number];

export default function ModelsScreen() {
  const db = useDb();
  const { activeModel, reload } = useLlm();
  const [models, setModels] = useState<Model[]>([]);
  const [downloadingUrl, setDownloadingUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const embeddings = useEmbeddings();
  const readEmbeddingState = (): EmbeddingModelState =>
    isEmbeddingModelDownloading()
      ? "downloading"
      : getEmbeddingModelUri()
        ? "ready"
        : "missing";
  const [embeddingState, setEmbeddingState] =
    useState<EmbeddingModelState>(readEmbeddingState);
  const [embeddingError, setEmbeddingError] = useState<string | null>(null);

  // User-initiated: the only path that downloads the embedding model.
  const handleDownloadEmbeddingModel = async () => {
    setEmbeddingError(null);
    setEmbeddingState("downloading");
    try {
      await downloadEmbeddingModel(db);
      embeddings.reload(); // load it and index existing capsules
    } catch (e) {
      setEmbeddingError(e instanceof Error ? e.message : "Download failed");
    } finally {
      setEmbeddingState(readEmbeddingState());
    }
  };

  const handleDeleteEmbeddingModel = () => {
    setEmbeddingError(null);
    deleteEmbeddingModel();
    embeddings.reload(); // releases the loaded context
    setEmbeddingState(readEmbeddingState());
  };

  const refresh = useCallback(() => setModels(listModels(db)), [db]);
  useFocusEffect(
    useCallback(() => {
      refresh();
      setEmbeddingState(readEmbeddingState());
      // A download started from an earlier visit to this screen: only that
      // visit's handler learned when it ended, so wait for it here too.
      let active = true;
      if (isEmbeddingModelDownloading()) {
        void waitForEmbeddingDownload().then(() => {
          if (active) setEmbeddingState(readEmbeddingState());
        });
      }
      return () => {
        active = false;
      };
    }, [refresh]),
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
    setError(null);
    try {
      const model = await downloadModel(db, spec);

      // A downloaded model that isn't selected is inert, and the chat screen
      // would tell the user to "download a model" they already have. If nothing
      // is active yet, make this one usable immediately.
      if (!getActiveModel(db)) {
        selectModel(db, model.id);
        reload();
      }
    } catch (e) {
      // Previously this rejected into the void: the button reset, no model
      // appeared, and nothing said why.
      setError(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDownloadingUrl(null);
      refresh();
    }
  };

  const downloadedNames = new Set(models.map((m) => m.name));
  const available = RECOMMENDED_MODELS.filter(
    (s) => !downloadedNames.has(s.name),
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
              testID={`${testIDs.pressables.model}_${model.id}`}
              style={styles.rowMain}
              onPress={() => handleSelect(model)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`${model.name}, ${model.parameters}, ${model.quantization}`}
            >
              <Text style={styles.name}>{model.name}</Text>
              <Text style={styles.meta}>
                {isActive ? "Active" : "Tap to use"} · {model.parameters} ·{" "}
                {model.quantization}
              </Text>
            </Pressable>
            <Pressable
              testID={`${testIDs.buttons.delete}_${model.id}`}
              onPress={() => handleDelete(model)}
              accessibilityRole="button"
              accessibilityLabel={`Delete model ${model.name}`}
            >
              <Text style={styles.delete}>Delete</Text>
            </Pressable>
          </View>
        );
      })}

      <Text style={styles.heading}>Capsule search</Text>
      <EmbeddingModelCard
        modelName={DEFAULT_EMBEDDING_MODEL.name}
        sizeLabel={DEFAULT_EMBEDDING_MODEL.sizeLabel}
        state={embeddingState}
        error={embeddingError}
        onDownload={handleDownloadEmbeddingModel}
        onDelete={handleDeleteEmbeddingModel}
      />

      <Text style={styles.heading}>Download</Text>
      {error && (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      )}
      {available.length === 0 && (
        <Text style={styles.muted}>All recommended models downloaded.</Text>
      )}
      {available.map((spec) => (
        <Pressable
          testID={`${testIDs.buttons.download}_${spec.id}`}
          key={spec.url}
          style={styles.row}
          disabled={downloadingUrl !== null}
          onPress={() => handleDownload(spec)}
          accessibilityRole="button"
          accessibilityLabel={`${downloadingUrl === spec.url ? "Downloading" : "Download"} ${spec.name}, ${spec.parameters}, ${spec.quantization}`}
          accessibilityState={{ disabled: downloadingUrl !== null }}
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
  error: {
    color: theme.colors.text,
    fontFamily: theme.fonts.sans,
    fontSize: 12,
    padding: theme.spacing.three,
    borderRadius: theme.spacing.two,
    backgroundColor: theme.colors.backgroundSelected,
    marginBottom: theme.spacing.two,
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

const testIDs = createComponentTestIDs("ModelsScreen", {
  pressables: ["model"] as const,
  buttons: ["delete", "download"] as const,
});

ModelsScreen.testIDs = testIDs;
