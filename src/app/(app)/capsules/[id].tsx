import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useDb, useEmbeddings } from "@/app/providers";
import {
  getAllCapsules,
  getCapsuleById,
  getChildCapsules,
  getValuesByCapsule,
  type Capsule,
  type CapsuleValue,
  type CapsuleVersion,
} from "@/entities/capsule";
import { getCapsuleTypeById, type CapsuleType } from "@/entities/capsule-type";
import { getFieldsByCapsuleType, type CapsuleField } from "@/entities/field";
import { getTagsByCapsule, type Tag } from "@/entities/tag";
import { getLinksFromByField } from "@/entities/link";
import { getAttachmentsByCapsuleField } from "@/entities/attachment";
import { getRemindersByCapsule, type Reminder } from "@/entities/reminder";
import { deleteCapsule } from "@/features/delete-capsule";
import { tagCapsule, untagCapsule } from "@/features/tag-capsule";
import { linkCapsules, unlinkCapsules } from "@/features/link-capsules";
import { setCapsuleParent } from "@/features/nest-capsule";
import {
  addAttachment,
  attachmentFileUri,
  removeAttachment,
} from "@/features/manage-attachments";
import { pickDocument, pickImage, type PickedSource } from "@/shared/picker";
import { addReminder, cancelReminder } from "@/features/manage-reminders";
import {
  getCapsuleHistory,
  restoreCapsuleVersion,
} from "@/features/capsule-versioning";
import { createComponentTestIDs } from "@/shared/testing";
import { TagPicker } from "@/widgets/TagPicker";
import { RelationPicker, type RelationEntry } from "@/widgets/RelationPicker";
import { VersionHistory } from "@/widgets/VersionHistory";
import { ParentPicker } from "@/widgets/ParentPicker";
import { AttachmentList, type AttachmentEntry } from "@/widgets/AttachmentList";
import {
  ReminderList,
  reminderPresets,
  resolvePreset,
  type ReminderPresetKey,
} from "@/widgets/ReminderList";

export default function CapsuleDetailScreen() {
  const db = useDb();
  const embeddings = useEmbeddings();
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
  const [history, setHistory] = useState<CapsuleVersion[]>([]);
  const [parent, setParent] = useState<Capsule | null>(null);
  const [children, setChildren] = useState<Capsule[]>([]);
  const [parentError, setParentError] = useState<string | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  // The time presets and "Today"/"passed" labels are computed against.
  // Refreshed on focus and after each reminder change, not ticking.
  const [now, setNow] = useState(() => Date.now());
  const [reminderBusy, setReminderBusy] = useState(false);
  const [reminderError, setReminderError] = useState<string | null>(null);
  const [attachmentsByFieldId, setAttachmentsByFieldId] = useState<
    Record<string, AttachmentEntry[]>
  >({});
  const [attachmentBusyFieldId, setAttachmentBusyFieldId] = useState<
    string | null
  >(null);
  const [attachmentError, setAttachmentError] = useState<{
    fieldId: string;
    message: string;
  } | null>(null);

  const loadAttachmentEntries = useCallback(
    (capsuleId: string, fieldId: string): AttachmentEntry[] =>
      getAttachmentsByCapsuleField(db, capsuleId, fieldId).map(
        (attachment) => ({ attachment, uri: attachmentFileUri(attachment) }),
      ),
    [db],
  );

  const refreshAttachmentField = useCallback(
    (fieldId: string) => {
      setAttachmentsByFieldId((current) => ({
        ...current,
        [fieldId]: loadAttachmentEntries(id, fieldId),
      }));
    },
    [id, loadAttachmentEntries],
  );

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
        setHistory(getCapsuleHistory(db, found.id));
        setParent(
          found.parentCapsuleId
            ? getCapsuleById(db, found.parentCapsuleId)
            : null,
        );
        setChildren(getChildCapsules(db, found.id));
        setReminders(getRemindersByCapsule(db, found.id));
        setNow(Date.now());

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

        const nextAttachments: Record<string, AttachmentEntry[]> = {};
        for (const field of capsuleFields) {
          if (field.fieldType === "attachment") {
            nextAttachments[field.id] = loadAttachmentEntries(
              found.id,
              field.id,
            );
          }
        }
        setAttachmentsByFieldId(nextAttachments);
      }
    }, [db, id, loadAttachmentEntries]),
  );

  // Pick → copy into app storage → record. addAttachment removes the
  // picker's temporary cache copy afterwards, whether the add succeeded or not.
  // One pick at a time across the whole screen. A ref, not state, so a fast
  // double tap can't open two pickers before the busy re-render lands.
  const attachmentInFlight = useRef(false);

  const handleAddAttachment = async (
    fieldId: string,
    pick: () => Promise<PickedSource | null>,
  ) => {
    if (attachmentInFlight.current) return;
    attachmentInFlight.current = true;
    setAttachmentError(null);
    setAttachmentBusyFieldId(fieldId);
    try {
      const picked = await pick();
      if (picked === null) return;
      await addAttachment(db, {
        capsuleId: id,
        fieldId,
        sourceUri: picked.uri,
        filename: picked.name,
        mimeType: picked.mimeType,
        size: picked.size,
        sourceIsTemporaryCopy: true,
      });
      refreshAttachmentField(fieldId);
    } catch (e) {
      setAttachmentError({
        fieldId,
        message: e instanceof Error ? e.message : "Couldn't add the file.",
      });
    } finally {
      attachmentInFlight.current = false;
      setAttachmentBusyFieldId(null);
    }
  };

  const handleRemoveAttachment = (fieldId: string, attachmentId: string) => {
    setAttachmentError(null);
    try {
      removeAttachment(db, attachmentId);
    } catch (e) {
      setAttachmentError({
        fieldId,
        message: e instanceof Error ? e.message : "Couldn't remove the file.",
      });
    }
    refreshAttachmentField(fieldId);
  };

  // One reminder change at a time; a ref so a double tap can't schedule
  // two notifications before the busy re-render lands.
  const reminderInFlight = useRef(false);

  const runReminderChange = async (
    change: () => Promise<string | null>,
    fallback: string,
  ) => {
    if (reminderInFlight.current) return;
    reminderInFlight.current = true;
    setReminderError(null);
    setReminderBusy(true);
    try {
      setReminderError(await change());
    } catch (e) {
      setReminderError(e instanceof Error ? e.message : fallback);
    } finally {
      reminderInFlight.current = false;
      setReminderBusy(false);
      setReminders(getRemindersByCapsule(db, id));
      setNow(Date.now());
    }
  };

  // addReminder asks for notification permission the first time. If it's
  // refused the reminder is still saved; the list marks it "not scheduled".
  // The preset's time is recomputed now: the screen may have been open a
  // while, so "In 1 hour" must mean from the tap, and a passed "This
  // evening" is refused rather than scheduled in the past.
  const handleAddReminder = (presetKey: ReminderPresetKey) =>
    runReminderChange(async () => {
      const at = resolvePreset(presetKey, Date.now());
      if (at === null) return "That time has already passed.";
      const { scheduled } = await addReminder(db, {
        capsuleId: id,
        remindAt: at,
      });
      return scheduled
        ? null
        : "Saved, but notifications are off for Capsule — allow them in Settings to be reminded.";
    }, "Couldn't set the reminder.");

  const handleCancelReminder = (reminderId: string) =>
    runReminderChange(async () => {
      await cancelReminder(db, reminderId);
      return null;
    }, "Couldn't cancel the reminder.");

  const handleDelete = () => {
    // deleteCapsule removes attachment files before any rows, so a failure
    // (e.g. a file the OS won't let go of) leaves the capsule intact —
    // tell the user instead of crashing, and let them retry.
    try {
      deleteCapsule(db, id);
    } catch (e) {
      Alert.alert(
        "Couldn't delete capsule",
        e instanceof Error ? e.message : "Something went wrong.",
      );
      return;
    }
    router.replace("/capsules");
  };

  // Restoring rewrites title + field values and (per restoreCapsuleVersion's
  // own contract) appends a fresh safety-snapshot of what was JUST
  // overwritten — so every piece of local state this screen shows from the
  // db needs a full re-fetch, not a hand-patch, mirroring this screen's own
  // existing "apply immediately, then re-fetch" convention for tags/links.
  const handleRestore = (versionId: string) => {
    restoreCapsuleVersion(db, versionId);
    embeddings.indexCapsule(id);
    const refreshed = getCapsuleById(db, id);
    setCapsule(refreshed);
    if (refreshed) {
      setValues(getValuesByCapsule(db, refreshed.id));
      setHistory(getCapsuleHistory(db, refreshed.id));
    }
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

  // setCapsuleParent (8.5) throws on a cycle (nesting under self or a
  // descendant) — the ONE handler on this screen that can reject an
  // otherwise-valid-looking action, so it needs its own try/catch and
  // error display, unlike every other "apply immediately" handler above.
  const handleSetParent = (parentId: string) => {
    try {
      setCapsuleParent(db, id, parentId);
      setParent(getCapsuleById(db, parentId));
      setParentError(null);
    } catch (error) {
      setParentError(
        error instanceof Error ? error.message : "Could not set parent.",
      );
    }
  };

  const handleClearParent = () => {
    setCapsuleParent(db, id, null);
    setParent(null);
    setParentError(null);
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
        .filter(
          (field) =>
            field.fieldType !== "relation" && field.fieldType !== "attachment",
        )
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

      {fields
        .filter((field) => field.fieldType === "attachment")
        .map((field) => (
          <View key={field.id} style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>{field.name}</Text>
            <AttachmentList
              entries={attachmentsByFieldId[field.id] ?? []}
              busy={attachmentBusyFieldId === field.id}
              error={
                attachmentError?.fieldId === field.id
                  ? attachmentError.message
                  : null
              }
              onAddFile={() => handleAddAttachment(field.id, pickDocument)}
              onAddPhoto={() => handleAddAttachment(field.id, pickImage)}
              onRemove={(attachmentId) =>
                handleRemoveAttachment(field.id, attachmentId)
              }
            />
          </View>
        ))}

      <View style={styles.fieldRow}>
        <Text style={styles.fieldLabel}>Reminders</Text>
        <ReminderList
          reminders={reminders}
          presets={reminderPresets(now)}
          now={now}
          onAdd={handleAddReminder}
          onCancel={handleCancelReminder}
          busy={reminderBusy}
          error={reminderError}
        />
      </View>

      <TagPicker
        tags={tags}
        onAddTag={handleAddTag}
        onRemoveTag={handleRemoveTag}
      />

      <VersionHistory versions={history} onRestore={handleRestore} />

      <ParentPicker
        parent={parent}
        availableCapsules={allCapsules.filter((c) => c.id !== capsule.id)}
        onSetParent={handleSetParent}
        onClearParent={handleClearParent}
        error={parentError}
      />

      {children.length > 0 && (
        <View testID={testIDs.containers.children} style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Children</Text>
          {children.map((child) => (
            <Pressable
              key={child.id}
              testID={`${testIDs.pressables.child}_${child.id}`}
              style={styles.childRow}
              onPress={() => router.push(`/capsules/${child.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`Open ${child.title}`}
            >
              <Text style={styles.childLabel}>{child.title}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <Pressable
        testID={testIDs.buttons.edit}
        style={styles.primary}
        onPress={() => router.push(`/capsules/${capsule.id}/edit`)}
        accessibilityRole="button"
      >
        <Text style={styles.primaryLabel}>Edit</Text>
      </Pressable>
      <Pressable
        testID={testIDs.buttons.delete}
        style={styles.secondary}
        onPress={handleDelete}
        accessibilityRole="button"
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
  childRow: {
    backgroundColor: theme.colors.backgroundElement,
    borderRadius: theme.spacing.two,
    paddingHorizontal: theme.spacing.two,
    paddingVertical: theme.spacing.one,
    marginTop: theme.spacing.one,
  },
  childLabel: {
    color: theme.colors.accent,
    fontFamily: theme.fonts.sans,
    fontSize: 13,
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
  containers: ["root", "children"] as const,
  buttons: ["edit", "delete"] as const,
  texts: ["notFound"] as const,
  pressables: ["child"] as const,
});
