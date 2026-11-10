import { Stack, router, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Avatar, ResultRow, Screen, VerifiedBadge } from "@/components/ui";
import { catalog } from "@/lib/catalog";
import { colors } from "@/lib/theme";

export default function CreatorStorefrontScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const creator = typeof slug === "string" ? catalog.getCreatorBySlug(slug) : undefined;
  const cuts = creator ? catalog.getDatacuts({ creatorId: creator.id }) : [];

  if (!creator) {
    return (
      <Screen>
        <View style={styles.missing}>
          <Text style={styles.missingTitle}>Creator not found</Text>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.link}>Go back</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: creator.name }} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.cover}>
          <View style={styles.coverRing} />
        </View>
        <View style={styles.info}>
          <Avatar creator={creator} size={72} />
          <View style={styles.nameRow}>
            <Text style={styles.name}>{creator.name}</Text>
            {creator.verified ? <VerifiedBadge /> : null}
          </View>
          <Text style={styles.specialty}>{creator.specialty}</Text>
          <Text style={styles.bio}>{creator.bio}</Text>
          <View style={styles.stats}>
            <Stat label="Datacuts" value={String(creator.cuts)} />
            <Stat label="Followers" value={creator.followers} />
          </View>
        </View>

        <View style={styles.listSection}>
          <Text style={styles.listTitle}>Datacuts for sale</Text>
          {cuts.map((cut) => (
            <ResultRow key={cut.id} cut={cut} />
          ))}
          {cuts.length === 0 ? (
            <Text style={styles.empty}>No listings yet.</Text>
          ) : null}
        </View>
      </ScrollView>
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
  scroll: { paddingBottom: 40 },
  cover: {
    height: 140,
    backgroundColor: colors.cover,
    overflow: "hidden",
  },
  coverRing: {
    position: "absolute",
    width: 200,
    height: 200,
    right: -30,
    top: -70,
    borderWidth: 1,
    borderColor: "#73887e",
    borderRadius: 100,
  },
  info: {
    paddingHorizontal: 20,
    marginTop: -36,
  },
  nameRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },
  name: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.ink,
    letterSpacing: -0.8,
  },
  specialty: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  bio: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 19,
    color: "#4d5a54",
  },
  stats: {
    marginTop: 16,
    flexDirection: "row",
    gap: 28,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  stat: {},
  statValue: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.ink,
  },
  statLabel: {
    marginTop: 2,
    fontSize: 9,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  listSection: {
    paddingHorizontal: 20,
    paddingTop: 28,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.ink,
    marginBottom: 14,
  },
  empty: {
    color: colors.muted,
    fontSize: 12,
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
