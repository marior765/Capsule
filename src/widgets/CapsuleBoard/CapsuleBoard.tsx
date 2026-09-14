import { ScrollView, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import type { Capsule } from "@/entities/capsule";
import type { BoardColumn } from "@/features/filter-sort-capsules";
import { createComponentTestIDs } from "@/shared/testing";
import { CapsuleCard } from "@/widgets/CapsuleCard";

type CapsuleBoardProps = {
  /** Already grouped by the caller (`groupCapsulesBySelectField`) — this widget only renders, it doesn't decide the grouping field or fetch anything. */
  columns: BoardColumn[];
  /** The one `CapsuleType` every capsule on the board shares — board view is always scoped to a single type, since a select field's options are only meaningful within one type's schema. */
  capsuleTypeName: string | null;
  onPressCapsule?: (capsule: Capsule) => void;
};

/**
 * Kanban-style board (8.7) — one horizontally-scrolling row of columns,
 * each a vertically-scrolling stack of `CapsuleCard`s in list mode.
 * Purely controlled and purely presentational, like `RelationPicker`/
 * `VersionHistory` — the grouping itself already happened in
 * `groupCapsulesBySelectField`, this only lays the result out.
 *
 * Read-only this beat: tapping a card navigates (same as list/card view),
 * there's no drag-and-drop or tap-to-move-column yet, and it doesn't
 * participate in bulk-select mode — moving a capsule between columns
 * today means opening it and changing the field's value directly, the
 * same as any other edit. Nested opposite-direction ScrollViews (an
 * outer horizontal one, inner vertical ones per column) is a standard,
 * safe React Native pattern — the conflict case to avoid is same-
 * direction nesting, which this isn't.
 */
export function CapsuleBoard({
  columns,
  capsuleTypeName,
  onPressCapsule,
}: CapsuleBoardProps) {
  return (
    <ScrollView
      testID={testIDs.containers.root}
      horizontal
      style={styles.root}
      contentContainerStyle={styles.content}
    >
      {columns.map((column) => (
        <View
          key={column.key}
          testID={`${testIDs.containers.column}_${column.key}`}
          style={styles.column}
        >
          <Text style={styles.columnHeading}>
            {column.label} ({column.capsules.length})
          </Text>
          <ScrollView style={styles.columnList}>
            {column.capsules.map((capsule) => (
              <CapsuleCard
                key={capsule.id}
                capsule={capsule}
                capsuleTypeName={capsuleTypeName}
                onPress={() => onPressCapsule?.(capsule)}
              />
            ))}
          </ScrollView>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
  },
  content: {
    padding: theme.spacing.three,
    gap: theme.spacing.three,
  },
  column: {
    width: 220,
  },
  columnHeading: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.sans,
    fontSize: 12,
    marginBottom: theme.spacing.two,
  },
  columnList: {
    flex: 1,
  },
}));

const testIDs = createComponentTestIDs("CapsuleBoard", {
  containers: ["root", "column"] as const,
});

CapsuleBoard.testIDs = testIDs;
