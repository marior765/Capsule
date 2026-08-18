import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useDb } from "@/app/providers";
import { getAllCapsules, type Capsule } from "@/entities/capsule";
import { getAllCapsuleTypes, type CapsuleType } from "@/entities/capsule-type";
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
        <Text style={styles.notice}>
          No capsule types exist yet — creating a capsule needs at least one
          type to hold it. Type management is not built yet.
        </Text>
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
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.sans,
    fontSize: 12,
    padding: theme.spacing.three,
  },
}));
