import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  Avatar,
  Glyph,
  IconButton,
  PageHeader,
  Screen,
  SectionTitle,
  VerifiedBadge,
} from "@/components/ui";
import { catalog } from "@/lib/catalog";
import { colors } from "@/lib/theme";

export default function CreatorsScreen() {
  const creators = catalog.getCreators();
  const featured = creators[0];
  const rest = creators.slice(1);

  return (
    <Screen>
      <SafeAreaView edges={["top"]} style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <PageHeader
            kicker="EXPERT STOREFRONTS"
            title="Creators"
            action={
              <IconButton onPress={() => undefined}>
                <Glyph name="users" size={18} color={colors.ink} />
              </IconButton>
            }
          />

          {featured ? (
            <Pressable
              style={styles.featured}
              onPress={() => router.push(`/creators/${featured.slug}`)}
            >
              <View style={styles.cover}>
                <Text style={styles.coverLabel}>FEATURED CREATOR</Text>
                <View style={styles.coverRing} />
              </View>
              <View style={styles.featuredInfo}>
                <Avatar creator={featured} size={61} />
                <Pressable style={styles.follow}>
                  <Text style={styles.followText}>Follow</Text>
                </Pressable>
                <View style={styles.nameRow}>
                  <Text style={styles.featuredName}>{featured.name}</Text>
                  {featured.verified ? <VerifiedBadge /> : null}
                </View>
                <Text style={styles.bio}>{featured.bio}</Text>
                <View style={styles.stats}>
                  <Stat label="Datacuts" value={String(featured.cuts)} />
                  <Stat label="Followers" value={featured.followers} />
                  <Stat label="Rating" value="4.9" />
                </View>
              </View>
            </Pressable>
          ) : null}

          <View style={styles.section}>
            <SectionTitle title="Creators to follow" actionLabel="View all" onAction={() => undefined} />
            <View style={styles.list}>
              {rest.map((creator) => (
                <Pressable
                  key={creator.id}
                  style={styles.row}
                  onPress={() => router.push(`/creators/${creator.slug}`)}
                >
                  <Avatar creator={creator} />
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowName}>{creator.name}</Text>
                    <Text style={styles.rowMeta}>
                      {creator.specialty} · {creator.cuts} datacuts
                    </Text>
                  </View>
                  <Pressable style={styles.followOutline}>
                    <Text style={styles.followOutlineText}>Follow</Text>
                  </Pressable>
                </Pressable>
              ))}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingBottom: 28 },
  featured: {
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    backgroundColor: colors.white,
    overflow: "hidden",
  },
  cover: {
    height: 128,
    backgroundColor: colors.cover,
    position: "relative",
    overflow: "hidden",
  },
  coverLabel: {
    position: "absolute",
    zIndex: 2,
    left: 14,
    top: 14,
    color: "#a9bbb2",
    fontSize: 7,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  coverRing: {
    position: "absolute",
    width: 185,
    height: 185,
    right: -20,
    top: -65,
    borderWidth: 1,
    borderColor: "#73887e",
    borderRadius: 93,
  },
  featuredInfo: {
    paddingTop: 16,
    paddingHorizontal: 17,
    paddingBottom: 17,
  },
  follow: {
    position: "absolute",
    top: 12,
    right: 15,
    borderRadius: 6,
    backgroundColor: colors.ink,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  followText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: "700",
  },
  nameRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 7,
    marginTop: 10,
  },
  featuredName: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.ink,
  },
  bio: {
    color: "#6f7c75",
    fontSize: 10,
    lineHeight: 15,
    marginTop: 4,
  },
  stats: {
    borderTopWidth: 1,
    borderTopColor: "#e4e7e1",
    marginTop: 14,
    paddingTop: 13,
    flexDirection: "row",
    gap: 25,
  },
  stat: {},
  statValue: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700",
  },
  statLabel: {
    color: "#85908b",
    fontSize: 8,
    marginTop: 2,
  },
  section: {
    paddingTop: 28,
    paddingHorizontal: 20,
  },
  list: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  row: {
    minHeight: 68,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rowCopy: {
    flex: 1,
  },
  rowName: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.ink,
  },
  rowMeta: {
    color: "#86918b",
    fontSize: 8,
    marginTop: 3,
  },
  followOutline: {
    borderWidth: 1,
    borderColor: "#cfd5ce",
    borderRadius: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  followOutlineText: {
    fontSize: 8,
    fontWeight: "700",
    color: colors.ink,
  },
});
