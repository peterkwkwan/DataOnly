import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  CategoryChip,
  CutCard,
  Glyph,
  Horizontal,
  Logo,
  Screen,
  SearchEntryLink,
  SectionTitle,
} from "@/components/ui";
import { catalog } from "@/lib/catalog";
import { colors } from "@/lib/theme";

export default function HomeScreen() {
  const categories = catalog.getCategories();
  const trending = catalog.getPopularDatacuts(3);

  return (
    <Screen>
      <SafeAreaView edges={["top"]} style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Logo />
            <View style={styles.profile}>
              <Text style={styles.profileText}>AR</Text>
            </View>
          </View>

          <View style={styles.welcome}>
            <Text style={styles.kicker}>Good morning, Alex</Text>
            <Text style={styles.hero}>
              What data will{"\n"}move you forward?
            </Text>
            <SearchEntryLink />
          </View>

          <View style={styles.section}>
            <SectionTitle
              title="Explore industries"
              actionLabel="See all"
              onAction={() => router.push("/explore")}
            />
            <Horizontal>
              {categories.map((category) => (
                <CategoryChip
                  key={category.id}
                  category={category}
                  onPress={() => router.push(`/explore/${category.slug}`)}
                />
              ))}
            </Horizontal>
          </View>

          <View style={[styles.section, styles.trending]}>
            <SectionTitle
              title="Trending now"
              kicker="CURATED FOR YOU"
              actionLabel="View all"
              onAction={() => router.push("/explore")}
            />
            <Horizontal>
              {trending.map((cut) => (
                <CutCard key={cut.id} cut={cut} />
              ))}
            </Horizontal>
          </View>

          <Pressable style={styles.sellerBanner} onPress={() => router.push("/creators")}>
            <View style={styles.sellerIcon}>
              <Glyph name="database" size={22} color={colors.ink} />
            </View>
            <View style={styles.sellerCopy}>
              <Text style={styles.sellerKicker}>FOR CREATORS</Text>
              <Text style={styles.sellerTitle}>Turn expertise into income</Text>
            </View>
            <Glyph name="arrow" size={18} color={colors.white} />
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingBottom: 28 },
  header: {
    height: 63,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  profile: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  profileText: {
    color: colors.signal,
    fontSize: 10,
    fontWeight: "700",
  },
  welcome: {
    paddingHorizontal: 20,
    paddingTop: 25,
    paddingBottom: 29,
    backgroundColor: colors.welcome,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.welcomeLine,
  },
  kicker: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  hero: {
    marginTop: 10,
    marginBottom: 23,
    fontSize: 36,
    lineHeight: 38,
    fontWeight: "700",
    letterSpacing: -2.2,
    color: colors.ink,
  },
  section: {
    paddingTop: 28,
    paddingHorizontal: 20,
  },
  trending: {
    paddingTop: 34,
  },
  sellerBanner: {
    marginTop: 30,
    marginHorizontal: 20,
    marginBottom: 8,
    padding: 15,
    borderRadius: 10,
    backgroundColor: colors.ink,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sellerIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.signal,
    alignItems: "center",
    justifyContent: "center",
  },
  sellerCopy: {
    flex: 1,
  },
  sellerKicker: {
    color: "#9eafa7",
    fontSize: 7,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 4,
  },
  sellerTitle: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "700",
  },
});
