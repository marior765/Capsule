import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useDb } from "@/app/providers";
import {
  getAllCapsules,
  getCapsuleById,
  getValuesByCapsule,
  type Capsule,
  type CapsuleValue,
} from "@/entities/capsule";
import { getCapsuleTypeById, type CapsuleType } from "@/entities/capsule-type";
import { getFieldsByCapsuleType, type CapsuleField } from "@/entities/field";
import { getTagsByCapsule, type Tag } from "@/entities/tag";
import { getLinksFromByField } from "@/entities/link";
import { deleteCapsule } from "@/features/delete-capsule";
import { tagCapsule, untagCapsule } from "@/features/tag-capsule";
import { linkCapsules, unlinkCapsules } from "@/features/link-capsules";
import { createComponentTestIDs } from "@/shared/testing";
import { TagPicker } from "@/widgets/TagPicker";
import { RelationPicker, type RelationEntry } from "@/widgets/RelationPicker";

export default function CapsuleDetailScreen() {
  const db = useDb();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [capsule, setCapsule] = useState<Capsule | null>(null);
  const [capsuleType, setCapsuleType] = useState<CapsuleType | null>(null);
  const [fields, setFields] = useState<CapsuleField[]>([]);
  const [values, setValues] = useState<CapsuleValue[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [allCapsules, setAllCapsules] = useState<Capsule[]>([]);
  const [relationsByFieldId, setRelationsByFieldId] = useState<
    Record<string, RelationEntry[]>
  >({});

  const refreshRelationField = useCallback(
    (fieldId: string) => {
      setRelationsByFieldId((current) => ({
        ...current,
        [fieldId]: getLinksFromByField(db, id, fieldId).map((link) => ({
          link,
          capsule: getCapsuleById(db, link.toCapsuleId),
        })),
      }));
    },
    [db, id],
  );

  useFocusEffect(
    useCallback(() => {
      const found = getCapsuleById(db, id);
      setCapsule(found);
      if (found) {
        const capsuleFields = getFieldsByCapsuleType(db, found.capsuleTypeId);
        setCapsuleType(getCapsuleTypeById(db, found.capsuleTypeId));
        setFields(capsuleFields);
        setValues(getValuesByCapsule(db, found.id));
        setTags(getTagsByCapsule(db, found.id));
        setAllCapsules(getAllCapsules(db));

        const relationFields = capsuleFields.filter(
          (field) => field.fieldType === "relation",
        );
        const nextRelations: Record<string, RelationEntry[]> = {};
        for (const field of relationFields) {
          nextRelations[field.id] = getLinksFromByField(
            db,
            found.id,
            field.id,
          ).map((link) => ({
            link,
            capsule: getCapsuleById(db, link.toCapsuleId),
          }));
        }
        setRelationsByFieldId(nextRelations);
      }
    }, [db, id]),
  );

  const handleDelete = () => {
    deleteCapsule(db, id);
    router.replace("/capsules");
  };

  // Tags apply immediately, like SchemaBuilder's field mutations on an
  // already-existing type (types/[id].tsx) — a real feature-layer call,
  // then re-fetch from the db, rather than hand-patching local state.
  const handleAddTag = (name: string) => {
    tagCapsule(db, id, name);
    setTags(getTagsByCapsule(db, id));
  };

  const handleRemoveTag = (tagId: string) => {
    untagCapsule(db, id, tagId);
    setTags(getTagsByCapsule(db, id));
  };

  // Same "already exists -> apply immediately, then re-fetch" shape as
  // tags. Scoped per relation field (fieldId), since a capsule type can
  // define more than one relation field with independent link sets.
  const handleLinkRelation = (fieldId: string, targetCapsuleId: string) => {
    linkCapsules(db, id, targetCapsuleId, { fieldId });
    refreshRelationField(fieldId);
  };

  const handleUnlinkRelation = (fieldId: string, linkId: string) => {
    unlinkCapsules(db, linkId);
    refreshRelationField(fieldId);
  };

  if (!capsule) {
    return (
      <View testID={testIDs.containers.root} style={styles.root}>
        <Text testID={testIDs.texts.notFound} style={styles.meta}>
          This capsule no longer exists.
        </Text>
      </View>
    );
  }

  const valueByFieldId = Object.fromEntries(
    values.map((v) => [v.fieldId, v.value]),
  );

  return (
    <ScrollView
      testID={testIDs.containers.root}
      style={styles.root}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.title}>{capsule.title}</Text>
      <Text style={styles.meta}>{capsuleType?.name ?? "Unknown type"}</Text>

      {fields
        .filter((field) => field.fieldType !== "relation")
        .map((field) => (
          <View key={field.id} style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>{field.name}</Text>
            <Text style={styles.fieldValue}>
              {valueByFieldId[field.id] || "—"}
            </Text>
          </View>
        ))}

      {fields
        .filter((field) => field.fieldType === "relation")
        .map((field) => (
          <View key={field.id} style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>{field.name}</Text>
            <RelationPicker
              linked={relationsByFieldId[field.id] ?? []}
              availableCapsules={allCapsules.filter((c) => c.id !== capsule.id)}
              onLink={(targetId) => handleLinkRelation(field.id, targetId)}
              onUnlink={(linkId) => handleUnlinkRelation(field.id, linkId)}
            />
          </View>
        ))}

      <TagPicker
        tags={tags}
        onAddTag={handleAddTag}
        onRemoveTag={handleRemoveTag}
      />

      <Pressable
        testID={testIDs.buttons.edit}
        style={styles.primary}
        onPress={() => router.push(`/capsules/${capsule.id}/edit`)}
      >
        <Text style={styles.primaryLabel}>Edit</Text>
      </Pressable>
      <Pressable
        testID={testIDs.buttons.delete}
        style={styles.secondary}
        onPress={handleDelete}
      >
        <Text style={styles.deleteLabel}>Delete capsule</Text>
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
  title: {
    color: theme.colors.text,
    fontFamily: theme.fonts.rounded,
    fontSize: 20,
    marginBottom: theme.spacing.one,
  },
  meta: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.sans,
    fontSize: 12,
  },
  fieldRow: {
    marginTop: theme.spacing.three,
  },
  fieldLabel: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.sans,
    fontSize: 12,
    marginBottom: theme.spacing.half,
  },
  fieldValue: {
    color: theme.colors.text,
    fontFamily: theme.fonts.sans,
    fontSize: 15,
  },
  primary: {
    alignItems: "center",
    paddingVertical: theme.spacing.three,
    borderRadius: theme.spacing.two,
    backgroundColor: theme.colors.backgroundSelected,
    marginTop: theme.spacing.four,
  },
  primaryLabel: {
    color: theme.colors.text,
    fontFamily: theme.fonts.rounded,
  },
  secondary: {
    alignItems: "center",
    paddingVertical: theme.spacing.three,
    marginTop: theme.spacing.two,
  },
  deleteLabel: {
    color: theme.colors.danger,
    fontFamily: theme.fonts.rounded,
  },
}));

const testIDs = createComponentTestIDs("CapsuleDetailScreen", {
  containers: ["root"] as const,
  buttons: ["edit", "delete"] as const,
  texts: ["notFound"] as const,
});
