import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Glyph, IndustryMark, ResultRow, Screen } from "@/components/ui";
import { catalog } from "@/lib/catalog";
import { colors } from "@/lib/theme";

const RECENT = ["Market sentiment", "Biomechanics"];

export default function SearchScreen() {
  const [query, setQuery] = useState("");
  const categories = catalog.getCategories();

  const filteredCategories = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, query]);

  const hits = useMemo(() => {
    if (!query.trim()) return null;
    return catalog.search(query);
  }, [query]);

  return (
    <Screen>
      <SafeAreaView edges={["top"]} style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.top}>
            <Pressable onPress={() => router.back()} style={styles.back} hitSlop={8}>
              <Text style={styles.backGlyph}>←</Text>
            </Pressable>
            <View style={styles.field}>
              <Glyph name="search" size={16} color={colors.muted} />
              <TextInput
                autoFocus
                value={query}
                onChangeText={setQuery}
                placeholder="Search DataOnly"
                placeholderTextColor={colors.soft}
                style={styles.input}
                returnKeyType="search"
              />
              {query ? (
                <Pressable style={styles.clear} onPress={() => setQuery("")}>
                  <Glyph name="close" size={14} color={colors.ink} />
                </Pressable>
              ) : null}
            </View>
          </View>

          <Text style={styles.label}>
            {query ? "MATCHING INDUSTRIES" : "POPULAR INDUSTRIES"}
          </Text>
          <View style={styles.categoryList}>
            {filteredCategories.map((category) => (
              <Pressable
                key={category.id}
                style={styles.categoryRow}
                onPress={() => {
                  router.back();
                  router.push(`/explore/${category.slug}`);
                }}
              >
                <View style={[styles.categoryIcon, { backgroundColor: category.color }]}>
                  <IndustryMark name={category.icon} size={16} />
                </View>
                <View style={styles.categoryCopy}>
                  <Text style={styles.categoryName}>{category.name}</Text>
                  <Text style={styles.categoryMeta}>{category.count} datacuts</Text>
                </View>
                <Glyph name="arrow" size={16} color={colors.muted} />
              </Pressable>
            ))}
          </View>

          {hits ? (
            <View style={styles.hits}>
              <Text style={styles.label}>DATACUTS</Text>
              {hits.datacuts.map((cut) => (
                <ResultRow key={cut.id} cut={cut} />
              ))}
              {hits.datacuts.length === 0 ? (
                <Text style={styles.emptyHint}>No datacuts match “{query}”.</Text>
              ) : null}
            </View>
          ) : (
            <View style={styles.recent}>
              <Text style={styles.label}>RECENT SEARCHES</Text>
              <View style={styles.recentRow}>
                {RECENT.map((item) => (
                  <Pressable key={item} style={styles.recentChip} onPress={() => setQuery(item)}>
                    <Text style={styles.recentText}>{item}</Text>
                    <Glyph name="close" size={12} color={colors.muted} />
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  top: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
  },
  back: {
    paddingVertical: 8,
    paddingHorizontal: 5,
  },
  backGlyph: {
    fontSize: 22,
    color: colors.ink,
    fontWeight: "600",
  },
  field: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: "#d8ddd5",
    borderRadius: 9,
    backgroundColor: colors.white,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    fontSize: 13,
    color: colors.ink,
    paddingVertical: 0,
  },
  clear: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#e8ebe5",
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    marginTop: 28,
    marginBottom: 10,
    color: "#87938d",
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  categoryList: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  categoryRow: {
    minHeight: 65,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryCopy: {
    flex: 1,
  },
  categoryName: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.ink,
  },
  categoryMeta: {
    color: "#89948e",
    fontSize: 8,
    marginTop: 3,
  },
  hits: {
    marginTop: 8,
  },
  emptyHint: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 8,
  },
  recent: {
    marginTop: 4,
  },
  recentRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  recentChip: {
    borderWidth: 1,
    borderColor: "#d8ddd5",
    backgroundColor: colors.white,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  recentText: {
    color: "#65716b",
    fontSize: 9,
  },
});
