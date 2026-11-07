import { router } from "expo-router";
import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  EmptyState,
  Glyph,
  IconButton,
  PageHeader,
  ResultRow,
  Screen,
} from "@/components/ui";
import { useSaved } from "@/context/SavedContext";
import { catalog } from "@/lib/catalog";
import { colors } from "@/lib/theme";

export default function SavedScreen() {
  const { savedIds } = useSaved();
  const cuts = useMemo(
    () => catalog.getDatacuts().filter((cut) => savedIds.includes(cut.id)),
    [savedIds],
  );

  return (
    <Screen>
      <SafeAreaView edges={["top"]} style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <PageHeader
            kicker="YOUR LIBRARY"
            title="Saved"
            action={
              <IconButton onPress={() => undefined}>
                <Glyph name="bookmark" size={18} color={colors.ink} filled />
              </IconButton>
            }
          />

          <View style={styles.summary}>
            <View style={styles.summaryBlock}>
              <Text style={styles.summaryValue}>{savedIds.length}</Text>
              <Text style={styles.summaryLabel}>Saved datacuts</Text>
            </View>
            <View style={[styles.summaryBlock, styles.summaryDivider]}>
              <Text style={styles.summaryValue}>3</Text>
              <Text style={styles.summaryLabel}>Following</Text>
            </View>
          </View>

          <View style={styles.list}>
            {cuts.map((cut) => (
              <ResultRow key={cut.id} cut={cut} metaRight="records" />
            ))}
            {cuts.length === 0 ? (
              <EmptyState
                title="Your library is empty"
                body="Save datacuts to compare or purchase later."
                actionLabel="Explore marketplace"
                onAction={() => router.push("/explore")}
              />
            ) : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingBottom: 28 },
  summary: {
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 17,
    borderRadius: 10,
    backgroundColor: colors.ink,
    flexDirection: "row",
  },
  summaryBlock: {
    flex: 1,
  },
  summaryDivider: {
    borderLeftWidth: 1,
    borderLeftColor: "#40534b",
    paddingLeft: 20,
  },
  summaryValue: {
    color: colors.signal,
    fontSize: 25,
    fontWeight: "700",
  },
  summaryLabel: {
    color: "#a8b7b0",
    fontSize: 8,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 4,
  },
  list: {
    paddingHorizontal: 20,
  },
});
