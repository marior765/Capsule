import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useLlm } from "@/app/providers";
import {
  getInferenceSettings,
  requiresModelReload,
  resetInferenceSettings,
  updateInferenceSettings,
} from "@/features/configure-inference";
import type { InferenceSettings } from "@/shared/config";

type Field = {
  key: keyof InferenceSettings;
  label: string;
  hint: string;
  integer?: boolean;
};

const FIELDS: Field[] = [
  {
    key: "temperature",
    label: "Temperature",
    hint: "Randomness. Lower is more focused, higher more creative.",
  },
  { key: "topP", label: "Top-p", hint: "Nucleus sampling cutoff." },
  {
    key: "topK",
    label: "Top-k",
    hint: "Consider only the k most likely tokens.",
    integer: true,
  },
  {
    key: "repeatPenalty",
    label: "Repeat penalty",
    hint: "Higher values discourage repetition.",
  },
  {
    key: "contextLength",
    label: "Context length",
    hint: "Tokens the model can see. Changing this reloads the model.",
    integer: true,
  },
  {
    key: "seed",
    label: "Seed",
    hint: "-1 picks a random seed each time.",
    integer: true,
  },
];

export default function InferenceScreen() {
  const { reload, status } = useLlm();
  const [settings, setSettings] =
    useState<InferenceSettings>(getInferenceSettings);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [reloaded, setReloaded] = useState(false);

  const commit = (
    key: keyof InferenceSettings,
    raw: string,
    integer = false,
  ) => {
    const parsed = integer ? parseInt(raw, 10) : parseFloat(raw);

    // Discard unparseable input rather than persisting NaN.
    if (Number.isNaN(parsed)) {
      setDrafts((d) => ({ ...d, [key]: String(settings[key]) }));
      return;
    }

    const patch = { [key]: parsed } as Partial<InferenceSettings>;
    // Must be asked *before* the update — it compares against the stored value.
    const needsReload = requiresModelReload(patch);

    setSettings(updateInferenceSettings(patch));
    setDrafts((d) => ({ ...d, [key]: String(parsed) }));

    if (needsReload) {
      reload();
      setReloaded(true);
    }
  };

  const handleReset = () => {
    const needsReload = requiresModelReload({
      contextLength: getInferenceSettings().contextLength,
    });
    resetInferenceSettings();
    setSettings(getInferenceSettings());
    setDrafts({});
    reload();
    setReloaded(needsReload);
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Inference</Text>
      <Text style={styles.meta}>
        Applies to every new reply. Changes are saved as you type.
      </Text>

      {FIELDS.map((field) => (
        <View key={field.key} style={styles.field}>
          <Text style={styles.label}>{field.label}</Text>
          <TextInput
            style={styles.input}
            value={drafts[field.key] ?? String(settings[field.key])}
            onChangeText={(text) =>
              setDrafts((d) => ({ ...d, [field.key]: text }))
            }
            onEndEditing={(e) =>
              commit(field.key, e.nativeEvent.text, field.integer)
            }
            keyboardType="numbers-and-punctuation"
            inputMode="numeric"
          />
          <Text style={styles.meta}>{field.hint}</Text>
        </View>
      ))}

      {reloaded && (
        <Text style={styles.notice}>
          Context length changed — the model is reloading ({status}).
        </Text>
      )}

      <Pressable style={styles.reset} onPress={handleReset}>
        <Text style={styles.resetLabel}>Reset to defaults</Text>
      </Pressable>
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
  field: {
    marginTop: theme.spacing.three,
  },
  label: {
    color: theme.colors.text,
    fontFamily: theme.fonts.sans,
    marginBottom: theme.spacing.one,
  },
  input: {
    backgroundColor: theme.colors.backgroundElement,
    color: theme.colors.text,
    fontFamily: theme.fonts.mono,
    padding: theme.spacing.three,
    borderRadius: theme.spacing.two,
  },
  meta: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.sans,
    fontSize: 12,
    marginTop: theme.spacing.one,
  },
  notice: {
    marginTop: theme.spacing.three,
    padding: theme.spacing.three,
    borderRadius: theme.spacing.two,
    backgroundColor: theme.colors.backgroundElement,
    color: theme.colors.text,
    fontFamily: theme.fonts.sans,
    fontSize: 12,
  },
  reset: {
    marginTop: theme.spacing.five,
    alignItems: "center",
    paddingVertical: theme.spacing.three,
    borderRadius: theme.spacing.two,
    backgroundColor: theme.colors.backgroundSelected,
  },
  resetLabel: {
    color: theme.colors.text,
    fontFamily: theme.fonts.rounded,
  },
}));
