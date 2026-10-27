import { useState } from "react";
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useLlm } from "@/app/providers";
import {
  getInferenceSettings,
  requiresModelReload,
  resetInferenceSettings,
  updateInferenceSettings,
  validateInferenceValue,
} from "@/features/configure-inference";
import type { InferenceSettings } from "@/shared/config";
import { createComponentTestIDs } from "@/shared/testing";

type Field = {
  key: keyof InferenceSettings;
  label: string;
  hint: string;
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
  },
  {
    key: "seed",
    label: "Seed",
    hint: "-1 picks a random seed each time.",
  },
];

export default function InferenceScreen() {
  const { reload, status } = useLlm();
  const [settings, setSettings] =
    useState<InferenceSettings>(getInferenceSettings);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [reloaded, setReloaded] = useState(false);
  // Per-field message for a value that can't be used; what was typed stays
  // in the box so it can be fixed, and nothing is saved until it's valid.
  const [errors, setErrors] = useState<
    Partial<Record<keyof InferenceSettings, string>>
  >({});

  const commit = (key: keyof InferenceSettings, raw: string) => {
    const result = validateInferenceValue(key, raw);
    if ("error" in result) {
      setErrors((e) => ({ ...e, [key]: result.error }));
      // Live regions are Android-only; VoiceOver needs an announcement
      // (Android already reads the error's live region — don't say it twice).
      if (Platform.OS === "ios")
        AccessibilityInfo.announceForAccessibility(
          `${FIELDS.find((f) => f.key === key)?.label ?? key}: ${result.error} Not saved.`,
        );
      return;
    }
    setErrors((e) => ({ ...e, [key]: undefined }));
    const parsed = result.value;

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
    setErrors({});
    reload();
    setReloaded(needsReload);
  };

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      style={styles.root}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.heading}>Inference</Text>
      <Text style={styles.meta}>
        Applies to every new reply. A change is saved when you leave its field.
      </Text>

      {FIELDS.map((field) => (
        <View key={field.key} style={styles.field}>
          <Text style={styles.label}>{field.label}</Text>
          <TextInput
            testID={`${testIDs.inputs.field}_${field.key}`}
            value={drafts[field.key] ?? String(settings[field.key])}
            onChangeText={(text) =>
              setDrafts((d) => ({ ...d, [field.key]: text }))
            }
            onEndEditing={(e) => commit(field.key, e.nativeEvent.text)}
            // Has "-" and "." (seed -1, temperature 0.7); a decimal pad has
            // no minus key.
            keyboardType="numbers-and-punctuation"
            accessibilityLabel={field.label}
            accessibilityHint={errors[field.key]}
            style={[styles.input, errors[field.key] && styles.inputInvalid]}
          />
          {errors[field.key] ? (
            <Text
              testID={`${testIDs.texts.error}_${field.key}`}
              style={styles.error}
              accessibilityLiveRegion="polite"
            >
              {errors[field.key]} Not saved.
            </Text>
          ) : (
            <Text style={styles.meta}>{field.hint}</Text>
          )}
        </View>
      ))}

      {reloaded && (
        <Text style={styles.notice} accessibilityLiveRegion="polite">
          Context length changed — the model is reloading ({status}).
        </Text>
      )}

      <Pressable
        testID={testIDs.buttons.reset}
        style={styles.reset}
        onPress={handleReset}
        accessibilityRole="button"
      >
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
  inputInvalid: {
    borderWidth: 1,
    borderColor: theme.colors.danger,
  },
  error: {
    color: theme.colors.danger,
    fontFamily: theme.fonts.sans,
    fontSize: 12,
    marginTop: theme.spacing.one,
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

const testIDs = createComponentTestIDs("InferenceScreen", {
  inputs: ["field"] as const,
  texts: ["error"] as const,
  buttons: ["reset"] as const,
});

InferenceScreen.testIDs = testIDs;
