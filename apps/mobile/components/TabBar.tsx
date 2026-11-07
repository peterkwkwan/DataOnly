import { router, type Href } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Glyph, type GlyphName } from "@/components/ui";
import { colors } from "@/lib/theme";

type TabKey = "index" | "explore" | "creators" | "saved";

const TABS: { key: TabKey; label: string; icon: GlyphName; href: Href }[] = [
  { key: "index", label: "Home", icon: "home", href: "/" },
  { key: "explore", label: "Explore", icon: "layers", href: "/explore" },
  { key: "creators", label: "Creators", icon: "users", href: "/creators" },
  { key: "saved", label: "Saved", icon: "bookmark", href: "/saved" },
];

export function DataOnlyTabBar({ active }: { active: TabKey }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <TabButton tab={TABS[0]} active={active === "index"} />
      <TabButton tab={TABS[1]} active={active === "explore"} />
      <Pressable style={styles.search} onPress={() => router.push("/search")} accessibilityLabel="Search">
        <Glyph name="search" size={20} color={colors.signal} />
      </Pressable>
      <TabButton tab={TABS[2]} active={active === "creators"} />
      <TabButton
        tab={TABS[3]}
        active={active === "saved"}
        filled={active === "saved"}
      />
    </View>
  );
}

function TabButton({
  tab,
  active,
  filled = false,
}: {
  tab: (typeof TABS)[number];
  active: boolean;
  filled?: boolean;
}) {
  return (
    <Pressable style={styles.tab} onPress={() => router.push(tab.href)}>
      <Glyph name={tab.icon} size={18} color={active ? colors.ink : "#89938e"} filled={filled || active} />
      <Text style={[styles.label, active && styles.labelActive]}>{tab.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "flex-end",
    borderTopWidth: 1,
    borderTopColor: "#dbe0d8",
    backgroundColor: "rgba(250,251,247,0.97)",
    paddingTop: 8,
    paddingHorizontal: 10,
    height: undefined,
    minHeight: 64,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 3,
    paddingBottom: 4,
  },
  label: {
    fontSize: 8,
    color: "#89938e",
  },
  labelActive: {
    color: colors.ink,
    fontWeight: "700",
  },
  search: {
    width: 49,
    height: 49,
    marginTop: -20,
    marginBottom: 4,
    borderRadius: 25,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.ink,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 7 },
    elevation: 6,
  },
});
