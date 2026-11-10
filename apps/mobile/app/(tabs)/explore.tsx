import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  EmptyState,
  Glyph,
  IconButton,
  PageHeader,
  ResultRow,
  Screen,
} from "@/components/ui";
import { catalog } from "@/lib/catalog";
import { colors } from "@/lib/theme";

export default function ExploreScreen() {
  const params = useLocalSearchParams<{ category?: string }>();
  const categories = catalog.getCategories();
  const initial =
    typeof params.category === "string" && params.category.length > 0
      ? params.category
      : "All";
  const [active, setActive] = useState(initial);

  const chips = useMemo(() => ["All", ...categories.map((c) => c.name)], [categories]);

  const results = useMemo(() => {
    if (active === "All") return catalog.getDatacuts();
    const match = categories.find((c) => c.name === active);
    return match ? catalog.getDatacuts({ categoryId: match.id }) : [];
  }, [active, categories]);

  return (
    <Screen>
      <SafeAreaView edges={["top"]} style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <PageHeader
            kicker="MARKETPLACE"
            title="Explore"
            action={
              <IconButton onPress={() => router.push("/search")}>
                <Glyph name="search" size={18} color={colors.ink} />
              </IconButton>
            }
          />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
          >
            {chips.map((chip) => {
              const on = chip === active;
              return (
                <Pressable
                  key={chip}
                  style={[styles.chip, on && styles.chipActive]}
                  onPress={() => setActive(chip)}
                >
                  <Text style={[styles.chipText, on && styles.chipTextActive]}>{chip}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.meta}>
            <Text style={styles.metaTitle}>
              {active === "All" ? "Popular datacuts" : active}
            </Text>
            <View style={styles.metaSort}>
              <Text style={styles.metaSortText}>Popular</Text>
              <Glyph name="chevron" size={12} color="#78847e" />
            </View>
          </View>

          <View style={styles.list}>
            {results.map((cut) => (
              <ResultRow key={cut.id} cut={cut} />
            ))}
            {results.length === 0 ? (
              <EmptyState
                title="More data coming soon"
                body="Follow this industry to hear about new datacuts."
                actionLabel="Browse all data"
                onAction={() => setActive("All")}
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
  scroll: { paddingBottom: 24 },
  chips: {
    paddingHorizontal: 20,
    paddingBottom: 18,
    gap: 7,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  chip: {
    borderWidth: 1,
    borderColor: "#d8ddd5",
    borderRadius: 20,
    backgroundColor: colors.white,
    paddingHorizontal: 13,
    paddingVertical: 9,
    marginRight: 7,
  },
  chipActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  chipText: {
    color: "#69766f",
    fontSize: 10,
    fontWeight: "600",
  },
  chipTextActive: {
    color: colors.white,
  },
  meta: {
    paddingHorizontal: 20,
    paddingTop: 19,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  metaTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.ink,
  },
  metaSort: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaSortText: {
    color: "#78847e",
    fontSize: 10,
  },
  list: {
    paddingHorizontal: 20,
  },
});
