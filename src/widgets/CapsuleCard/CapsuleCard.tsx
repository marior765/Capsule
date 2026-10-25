import { Pressable, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { createComponentTestIDs } from "@/shared/testing";
import type { Capsule } from "@/entities/capsule";
import { listSubtitle, visibleTags, type CardPreview } from "./cardSummary";

type CapsuleCardProps = {
  capsule: Capsule;
  /**
   * Resolved by the caller (`CapsuleList`), not looked up here — this
   * component stays presentational, no db access. `null` when the
   * capsule's `capsuleTypeId` doesn't resolve to an existing type
   * (deleted type, or any other dangling reference) — CLAUDE.md's
   * graceful-degradation rule for capsule-domain references applies here
   * the same way it does for `CapsuleLink`, even though this isn't a link.
   */
  capsuleTypeName: string | null;
  onPress?: () => void;
  /**
   * True while the list is in bulk-select mode (8.5) — this component has
   * no opinion on what a press MEANS (navigate vs. toggle selection,
   * decided by the caller); it only changes what gets rendered, so a
   * selection checkbox never appears outside select mode.
   */
  selectionMode?: boolean;
  selected?: boolean;
  /**
   * "list" (default, a single-column full-width row) or "card" (8.7 —
   * a 2-column grid tile). Purely a rendering choice, same shape either
   * way — this component has no opinion on layout beyond its own
   * styling; `CapsuleList` decides `numColumns`.
   */
  viewMode?: "list" | "card";
  /**
   * Tags and the first filled-in field values (10.24), resolved by the
   * caller. The list row packs them into one line; the card tile labels
   * each value. Absent → title and type only.
   */
  preview?: CardPreview;
};

/**
 * One capsule's summary — title + its type's name (or a fallback). The
 * root testID appends `capsule.id` (a stable domain id, not a
 * render-order index) — mirrors `ChatBubble`'s own established pattern,
 * necessary here because `CapsuleList` renders many of these at once and
 * each one needs a distinct, stable testID to be individually targetable.
 */
export function CapsuleCard({
  capsule,
  capsuleTypeName,
  onPress,
  selectionMode = false,
  selected = false,
  viewMode = "list",
  preview,
}: CapsuleCardProps) {
  const isCard = viewMode === "card";
  const tags = visibleTags(preview?.tags ?? [], isCard ? 3 : 2);
  const tagText = [
    ...tags.shown.map((tag) => `#${tag}`),
    ...(tags.more > 0 ? [`+${tags.more}`] : []),
  ].join("  ");
  return (
    <Pressable
      testID={`${testIDs.pressables.root}_${capsule.id}`}
      style={[
        styles.root,
        isCard && styles.cardRoot,
        selectionMode && selected && styles.selected,
      ]}
      onPress={onPress}
      accessibilityRole={selectionMode ? "checkbox" : "button"}
      accessibilityState={selectionMode ? { checked: selected } : undefined}
      accessibilityLabel={[
        capsule.title,
        capsuleTypeName ?? "Unknown type",
        ...(preview?.fields ?? []).map((f) => `${f.name} ${f.value}`),
        ...(preview?.tags.length ? [`tags ${preview.tags.join(", ")}`] : []),
      ].join(", ")}
    >
      {selectionMode && (
        // Decorative — the Pressable's own accessibilityRole/State above
        // already conveys "checkbox, checked/unchecked" to a screen
        // reader; without hiding this, VoiceOver/TalkBack would also read
        // the raw "●"/"○" glyph, which says nothing on its own.
        <Text
          testID={`${testIDs.texts.checkbox}_${capsule.id}`}
          style={styles.checkbox}
          importantForAccessibility="no"
          accessibilityElementsHidden
        >
          {selected ? "●" : "○"}
        </Text>
      )}
      <View style={styles.info}>
        <Text
          style={[styles.title, isCard && styles.cardTitle]}
          numberOfLines={isCard ? 2 : 1}
        >
          {capsule.title}
        </Text>
        {isCard ? (
          <>
            <Text style={styles.typeName}>
              {capsuleTypeName ?? "Unknown type"}
            </Text>
            {(preview?.fields.length ?? 0) > 0 && (
              <View testID={`${testIDs.texts.fields}_${capsule.id}`}>
                {preview?.fields.map((field, index) => (
                  <Text
                    // Index too: older or imported data can hold two
                    // fields with one name on the same type.
                    key={`${index}-${field.name}`}
                    style={styles.fieldLine}
                    numberOfLines={1}
                  >
                    <Text style={styles.fieldName}>{field.name}: </Text>
                    {field.value}
                  </Text>
                ))}
              </View>
            )}
          </>
        ) : (
          <Text
            testID={`${testIDs.texts.fields}_${capsule.id}`}
            style={styles.typeName}
            numberOfLines={1}
          >
            {listSubtitle(capsuleTypeName, preview)}
          </Text>
        )}
        {tagText !== "" && (
          <Text
            testID={`${testIDs.texts.tags}_${capsule.id}`}
            style={styles.tags}
            numberOfLines={1}
          >
            {tagText}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: theme.spacing.three,
    paddingHorizontal: theme.spacing.three,
    borderRadius: theme.spacing.two,
    backgroundColor: theme.colors.backgroundElement,
    marginBottom: theme.spacing.two,
  },
  selected: {
    backgroundColor: theme.colors.backgroundSelected,
  },
  cardRoot: {
    flex: 1,
    flexDirection: "column",
    alignItems: "flex-start",
    minHeight: 96,
  },
  checkbox: {
    color: theme.colors.accent,
    fontSize: 16,
    marginRight: theme.spacing.two,
  },
  info: {
    flex: 1,
  },
  title: {
    color: theme.colors.text,
    fontFamily: theme.fonts.sans,
    fontSize: 15,
  },
  fieldLine: {
    color: theme.colors.text,
    fontFamily: theme.fonts.sans,
    fontSize: 12,
    marginTop: theme.spacing.half,
  },
  fieldName: {
    color: theme.colors.textSecondary,
  },
  tags: {
    color: theme.colors.accent,
    fontFamily: theme.fonts.sans,
    fontSize: 12,
    marginTop: theme.spacing.one,
  },
  cardTitle: {
    fontFamily: theme.fonts.rounded,
  },
  typeName: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.sans,
    fontSize: 12,
    marginTop: theme.spacing.half,
  },
}));

const testIDs = createComponentTestIDs("CapsuleCard", {
  pressables: ["root"] as const,
  texts: ["checkbox", "fields", "tags"] as const,
});

CapsuleCard.testIDs = testIDs;
