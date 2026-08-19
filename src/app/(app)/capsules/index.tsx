import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useDb } from "@/app/providers";
import { getAllCapsules, type Capsule } from "@/entities/capsule";
import { getAllCapsuleTypes, type CapsuleType } from "@/entities/capsule-type";
import { createComponentTestIDs } from "@/shared/testing";
import { CapsuleList } from "@/widgets/CapsuleList";

export default function CapsuleListScreen() {
  const db = useDb();
  const [capsules, setCapsules] = useState<Capsule[]>([]);
  const [capsuleTypes, setCapsuleTypes] = useState<CapsuleType[]>([]);

  useFocusEffect(
    useCallback(() => {
      setCapsules(getAllCapsules(db));
      setCapsuleTypes(getAllCapsuleTypes(db));
    }, [db]),
  );

  const capsuleTypesById = Object.fromEntries(
    capsuleTypes.map((type) => [type.id, type]),
  );

  return (
    <View style={styles.root}>
      {capsuleTypes.length === 0 && (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            No capsule types exist yet — creating a capsule needs at least one
            type to hold it.
          </Text>
          <Pressable
            testID={testIDs.pressables.createType}
            onPress={() => router.push("/types/new")}
          >
            <Text style={styles.noticeLink}>Create a type</Text>
          </Pressable>
        </View>
      )}
      <CapsuleList
        capsules={capsules}
        capsuleTypesById={capsuleTypesById}
        onPressCapsule={(capsule) => router.push(`/capsules/${capsule.id}`)}
      />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  notice: {
    padding: theme.spacing.three,
  },
  noticeText: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.sans,
    fontSize: 12,
    marginBottom: theme.spacing.two,
  },
  noticeLink: {
    color: theme.colors.accent,
    fontFamily: theme.fonts.rounded,
    fontSize: 13,
  },
}));

const testIDs = createComponentTestIDs("CapsuleListScreen", {
  pressables: ["createType"] as const,
});
