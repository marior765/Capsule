import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useDb } from "@/app/providers";
import { createCapsule } from "@/features/create-capsule";
import { getAllCapsuleTypes, type CapsuleType } from "@/entities/capsule-type";
import { getFieldsByCapsuleType, type CapsuleField } from "@/entities/field";
import { createComponentTestIDs } from "@/shared/testing";
import { CapsuleEditor } from "@/widgets/CapsuleEditor";

export default function NewCapsuleScreen() {
  const db = useDb();
  const [capsuleTypes, setCapsuleTypes] = useState<CapsuleType[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [fields, setFields] = useState<CapsuleField[]>([]);
  const [title, setTitle] = useState("");
  const [values, setValues] = useState<Record<string, string | null>>({});

  useFocusEffect(
    useCallback(() => {
      setCapsuleTypes(getAllCapsuleTypes(db));
    }, [db]),
  );

  const handleSelectType = (capsuleType: CapsuleType) => {
    setSelectedTypeId(capsuleType.id);
    setFields(getFieldsByCapsuleType(db, capsuleType.id));
    setTitle("");
    setValues({});
  };

  const handleValueChange = (fieldId: string, value: string | null) => {
    setValues((current) => ({ ...current, [fieldId]: value }));
  };

  const handleCreate = () => {
    if (!selectedTypeId) return;
    const capsule = createCapsule(db, {
      capsuleTypeId: selectedTypeId,
      title: title.trim() || undefined,
      values,
    });
    router.replace(`/capsules/${capsule.id}`);
  };

  if (capsuleTypes.length === 0) {
    return (
      <View testID={testIDs.containers.root} style={styles.root}>
        <Text style={styles.meta}>
          No capsule types exist yet — creating a capsule needs at least one
          type to hold it.
        </Text>
        <Pressable
          testID={testIDs.pressables.createType}
          onPress={() => router.push("/types/new")}
        >
          <Text style={styles.link}>Create a type</Text>
        </Pressable>
      </View>
    );
  }

  if (!selectedTypeId) {
    return (
      <ScrollView
        testID={testIDs.containers.root}
        style={styles.root}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.heading}>Choose a type</Text>
        {capsuleTypes.map((capsuleType) => (
          <Pressable
            key={capsuleType.id}
            testID={`${testIDs.pressables.typeOption}_${capsuleType.id}`}
            style={styles.typeRow}
            onPress={() => handleSelectType(capsuleType)}
          >
            <Text style={styles.name}>{capsuleType.name}</Text>
            {capsuleType.description && (
              <Text style={styles.meta}>{capsuleType.description}</Text>
            )}
          </Pressable>
        ))}
      </ScrollView>
    );
  }

  return (
    <View testID={testIDs.containers.root} style={styles.root}>
      <CapsuleEditor
        title={title}
        onTitleChange={setTitle}
        fields={fields}
        values={values}
        onValueChange={handleValueChange}
      />
      <Pressable
        testID={testIDs.buttons.create}
        style={styles.primary}
        onPress={handleCreate}
      >
        <Text style={styles.primaryLabel}>Create capsule</Text>
      </Pressable>
    </View>
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
  },
  link: {
    color: theme.colors.accent,
    fontFamily: theme.fonts.rounded,
    fontSize: 13,
    marginTop: theme.spacing.two,
  },
  typeRow: {
    backgroundColor: theme.colors.backgroundElement,
    padding: theme.spacing.three,
    borderRadius: theme.spacing.two,
    marginBottom: theme.spacing.two,
  },
  name: {
    color: theme.colors.text,
    fontFamily: theme.fonts.sans,
  },
  primary: {
    alignItems: "center",
    paddingVertical: theme.spacing.three,
    borderRadius: theme.spacing.two,
    backgroundColor: theme.colors.backgroundSelected,
    margin: theme.spacing.three,
  },
  primaryLabel: {
    color: theme.colors.text,
    fontFamily: theme.fonts.rounded,
  },
}));

const testIDs = createComponentTestIDs("NewCapsuleScreen", {
  containers: ["root"] as const,
  pressables: ["createType", "typeOption"] as const,
  buttons: ["create"] as const,
});
