import { Stack, router, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { EmptyState, ResultRow, Screen } from "@/components/ui";
import { catalog } from "@/lib/catalog";
import { colors } from "@/lib/theme";

export default function ExploreCategoryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const category = typeof slug === "string" ? catalog.getCategoryBySlug(slug) : undefined;
  const cuts = category ? catalog.getDatacuts({ categoryId: category.id }) : [];

  if (!category) {
    return (
      <Screen>
        <View style={styles.missing}>
          <Text style={styles.missingTitle}>Category not found</Text>
          <Pressable onPress={() => router.replace("/explore")}>
            <Text style={styles.link}>Browse explore</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: category.name }} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.banner, { backgroundColor: category.color }]}>
          <Text style={styles.kicker}>INDUSTRY</Text>
          <Text style={styles.title}>{category.name}</Text>
          <Text style={styles.blurb}>{category.blurb}</Text>
          <Text style={styles.count}>{category.count} datacuts</Text>
        </View>

        <View style={styles.list}>
          <Text style={styles.listTitle}>In this category</Text>
          {cuts.map((cut) => (
            <ResultRow key={cut.id} cut={cut} />
          ))}
          {cuts.length === 0 ? (
            <EmptyState
              title="More data coming soon"
              body="Follow this industry to hear about new datacuts."
              actionLabel="Browse all data"
              onAction={() => router.replace("/explore")}
            />
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 40 },
  banner: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 24,
  },
  kicker: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.2,
    color: colors.ink,
    opacity: 0.7,
  },
  title: {
    marginTop: 8,
    fontSize: 32,
    fontWeight: "700",
    letterSpacing: -1.6,
    color: colors.ink,
  },
  blurb: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 19,
    color: colors.inkDeep,
    maxWidth: 340,
  },
  count: {
    marginTop: 14,
    fontSize: 11,
    fontWeight: "700",
    color: colors.ink,
  },
  list: {
    paddingHorizontal: 20,
    paddingTop: 22,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.ink,
    marginBottom: 12,
  },
  missing: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  missingTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.ink,
  },
  link: {
    fontWeight: "700",
    textDecorationLine: "underline",
    color: colors.ink,
  },
});
