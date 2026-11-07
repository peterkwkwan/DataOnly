import type { Category, Creator, Datacut, IndustryIconName } from "@dataonly/core";
import { Link, router } from "expo-router";
import type { ReactNode } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { useSaved } from "@/context/SavedContext";
import { colors } from "@/lib/theme";

export type GlyphName =
  | "arrow"
  | "bookmark"
  | "chevron"
  | "close"
  | "database"
  | "home"
  | "layers"
  | "search"
  | "shield"
  | "star"
  | "users";

const GLYPHS: Record<GlyphName, string> = {
  arrow: "→",
  bookmark: "bookmark",
  chevron: "▾",
  close: "×",
  database: "▦",
  home: "⌂",
  layers: "☰",
  search: "⌕",
  shield: "✓",
  star: "★",
  users: "☺",
};

export function Glyph({
  name,
  size = 18,
  color = colors.ink,
  filled = false,
}: {
  name: GlyphName;
  size?: number;
  color?: string;
  filled?: boolean;
}) {
  if (name === "bookmark") {
    return (
      <Text style={{ fontSize: size * 0.85, color, fontWeight: filled ? "800" : "400" }}>
        {filled ? "▮" : "▯"}
      </Text>
    );
  }
  return (
    <Text style={{ fontSize: size * 0.9, color, fontWeight: filled ? "800" : "600", lineHeight: size }}>
      {GLYPHS[name]}
    </Text>
  );
}

const INDUSTRY_MARK: Record<IndustryIconName, string> = {
  finance: "$",
  healthcare: "+",
  engineering: "⚙",
  culinary: "🍴",
  energy: "⚡",
  fitness: "◎",
};

export function IndustryMark({ name, size = 18 }: { name: IndustryIconName; size?: number }) {
  return (
    <Text style={{ fontSize: size, color: colors.ink, fontWeight: "700" }}>{INDUSTRY_MARK[name]}</Text>
  );
}

export function Logo() {
  return (
    <View style={styles.logo} accessibilityLabel="DataOnly home">
      <View style={styles.logoMark}>
        <View style={styles.logoBar} />
        <View style={[styles.logoBar, styles.logoBarMid]} />
        <View style={styles.logoBar} />
      </View>
      <Text style={styles.logoText}>
        Data<Text style={styles.logoAccent}>Only</Text>
      </Text>
    </View>
  );
}

export function VerifiedBadge() {
  return (
    <View style={styles.verified}>
      <Glyph name="shield" size={12} color={colors.ink} />
      <Text style={styles.verifiedText}>Verified</Text>
    </View>
  );
}

export function Art({ type, compact = false }: { type: string; compact?: boolean }) {
  return (
    <View style={[styles.art, compact && styles.artCompact]}>
      <View style={styles.artOrbOne} />
      <View style={styles.artOrbTwo} />
      <Text style={styles.artLabel}>DO / {type.toUpperCase()}</Text>
    </View>
  );
}

export function PageHeader({
  kicker,
  title,
  action,
}: {
  kicker: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.pageHeader}>
      <View>
        <Text style={styles.kicker}>{kicker}</Text>
        <Text style={styles.pageTitle}>{title}</Text>
      </View>
      {action}
    </View>
  );
}

export function IconButton({
  onPress,
  children,
  style,
}: {
  onPress: () => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.iconButton, style]}>
      {children}
    </Pressable>
  );
}

export function SectionTitle({
  title,
  kicker,
  actionLabel,
  onAction,
}: {
  title: string;
  kicker?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionTitle}>
      <View>
        {kicker ? <Text style={styles.sectionKicker}>{kicker}</Text> : null}
        <Text style={styles.sectionHeading}>{title}</Text>
      </View>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction}>
          <Text style={styles.sectionAction}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function CategoryChip({
  category,
  onPress,
}: {
  category: Category;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.categoryChip}>
      <View style={[styles.categoryIcon, { backgroundColor: category.color }]}>
        <IndustryMark name={category.icon} />
      </View>
      <Text style={styles.categoryName}>{category.name}</Text>
      <Text style={styles.categoryCount}>{category.count}</Text>
    </Pressable>
  );
}

export function CutCard({ cut }: { cut: Datacut }) {
  const { isSaved, toggleSaved } = useSaved();
  const saved = isSaved(cut.id);
  const creator = cut.creatorName;

  return (
    <Pressable
      style={styles.cutCard}
      onPress={() => router.push(`/datacuts/${cut.slug}`)}
    >
      <View style={[styles.cutArt, { backgroundColor: cut.accent }]}>
        <Art type={cut.art} />
        <Pressable
          style={[styles.savePill, saved && styles.savePillOn]}
          onPress={() => toggleSaved(cut.id)}
          hitSlop={8}
        >
          <Glyph name="bookmark" size={14} color={saved ? colors.signal : colors.ink} filled={saved} />
        </Pressable>
        <Text style={styles.cutCategory}>{cut.categoryName}</Text>
      </View>
      <View style={styles.cutCopy}>
        <View style={styles.row}>
          <Text style={styles.cutCreator}>{creator}</Text>
          <Glyph name="shield" size={11} color={colors.muted} />
        </View>
        <Text style={styles.cutTitle} numberOfLines={2}>
          {cut.title}
        </Text>
        <View style={styles.cutMeta}>
          <View style={styles.row}>
            <Glyph name="star" size={12} color={colors.star} filled />
            <Text style={styles.cutRating}> {cut.rating}</Text>
          </View>
          <Text style={styles.cutPrice}>${cut.price}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export function ResultRow({
  cut,
  metaRight,
}: {
  cut: Datacut;
  metaRight?: "price" | "records";
}) {
  const { isSaved, toggleSaved } = useSaved();
  const saved = isSaved(cut.id);

  return (
    <Pressable style={styles.resultCard} onPress={() => router.push(`/datacuts/${cut.slug}`)}>
      <View style={[styles.resultArt, { backgroundColor: cut.accent }]}>
        <Art type={cut.art} compact />
      </View>
      <View style={styles.resultCopy}>
        <Text style={styles.resultCategory}>{cut.categoryName}</Text>
        <Text style={styles.resultTitle} numberOfLines={2}>
          {cut.title}
        </Text>
        <View style={styles.row}>
          <Text style={styles.resultCreator}>{cut.creatorName}</Text>
          <Glyph name="shield" size={11} color={colors.muted} />
        </View>
        <View style={styles.resultMeta}>
          {metaRight === "records" ? (
            <Text style={styles.resultRating}>{cut.records} records</Text>
          ) : (
            <View style={styles.row}>
              <Glyph name="star" size={11} color={colors.star} filled />
              <Text style={styles.resultRating}> {cut.rating}</Text>
            </View>
          )}
          <Text style={styles.resultPrice}>${cut.price}</Text>
        </View>
      </View>
      <Pressable
        style={styles.resultSave}
        onPress={() => toggleSaved(cut.id)}
        hitSlop={10}
      >
        <Glyph name="bookmark" size={16} color={saved ? "#53725f" : colors.muted} filled={saved} />
      </Pressable>
    </Pressable>
  );
}

export function EmptyState({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <View style={styles.empty}>
      <Glyph name="layers" size={28} color="#94a198" />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
      <Pressable style={styles.emptyButton} onPress={onAction}>
        <Text style={styles.emptyButtonText}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

export function Avatar({
  creator,
  size = 41,
}: {
  creator: Pick<Creator, "initials" | "color">;
  size?: number;
}) {
  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: creator.color,
        },
      ]}
    >
      <Text style={[styles.avatarText, { fontSize: size * 0.32 }]}>{creator.initials}</Text>
    </View>
  );
}

export function Horizontal({ children }: { children: ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
      {children}
    </ScrollView>
  );
}

export function Screen({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.screen, style]}>{children}</View>;
}

export function SearchEntryLink() {
  return (
    <Link href="/search" asChild>
      <Pressable style={styles.searchTrigger}>
        <Glyph name="search" size={18} color={colors.soft} />
        <Text style={styles.searchTriggerText}>Search industries or datacuts</Text>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  logo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  logoMark: {
    width: 25,
    height: 25,
    borderRadius: 6,
    backgroundColor: colors.ink,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingHorizontal: 5,
  },
  logoBar: {
    width: 3,
    height: 12,
    borderRadius: 1,
    backgroundColor: colors.signal,
  },
  logoBarMid: {
    height: 16,
  },
  logoText: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.ink,
    letterSpacing: -0.6,
  },
  logoAccent: {
    color: colors.ink,
    fontWeight: "800",
  },
  verified: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
  },
  verifiedText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.ink,
  },
  art: {
    ...StyleSheet.absoluteFill,
    overflow: "hidden",
  },
  artCompact: {},
  artOrbOne: {
    position: "absolute",
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "rgba(18,33,27,0.12)",
    right: -10,
    top: -18,
  },
  artOrbTwo: {
    position: "absolute",
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.35)",
    left: 12,
    bottom: 18,
  },
  artLabel: {
    position: "absolute",
    left: 10,
    top: 10,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.6,
    color: "rgba(18,33,27,0.55)",
  },
  pageHeader: {
    paddingTop: 27,
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  kicker: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  pageTitle: {
    marginTop: 4,
    fontSize: 34,
    fontWeight: "700",
    letterSpacing: -2,
    color: colors.ink,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 16,
  },
  sectionKicker: {
    color: "#87938d",
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 1.1,
    marginBottom: 4,
  },
  sectionHeading: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.8,
    color: colors.ink,
  },
  sectionAction: {
    color: "#5e6b65",
    fontSize: 11,
    fontWeight: "700",
    paddingVertical: 3,
  },
  categoryChip: {
    width: 92,
    minHeight: 126,
    padding: 11,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    backgroundColor: colors.white,
    marginRight: 11,
  },
  categoryIcon: {
    width: 45,
    height: 45,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  categoryName: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.ink,
    marginBottom: 3,
  },
  categoryCount: {
    color: "#8b9590",
    fontSize: 8,
  },
  cutCard: {
    width: 244,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    marginRight: 11,
  },
  cutArt: {
    height: 128,
    position: "relative",
    overflow: "hidden",
  },
  savePill: {
    position: "absolute",
    zIndex: 3,
    top: 10,
    right: 10,
    width: 31,
    height: 31,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.88)",
    alignItems: "center",
    justifyContent: "center",
  },
  savePillOn: {
    backgroundColor: colors.ink,
  },
  cutCategory: {
    position: "absolute",
    zIndex: 3,
    left: 10,
    bottom: 10,
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.85)",
    textTransform: "uppercase",
    fontSize: 7,
    fontWeight: "700",
    letterSpacing: 0.5,
    color: colors.ink,
    overflow: "hidden",
  },
  cutCopy: {
    padding: 13,
  },
  cutCreator: {
    color: "#6e7d75",
    fontSize: 9,
    marginRight: 3,
  },
  cutTitle: {
    minHeight: 35,
    marginTop: 6,
    marginBottom: 12,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
    color: colors.ink,
  },
  cutMeta: {
    paddingTop: 11,
    borderTopWidth: 1,
    borderTopColor: "#e7e9e4",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cutRating: {
    color: "#5e6b65",
    fontSize: 9,
  },
  cutPrice: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.ink,
  },
  resultCard: {
    minHeight: 118,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    backgroundColor: colors.white,
    padding: 9,
    flexDirection: "row",
    gap: 11,
    marginBottom: 10,
    position: "relative",
  },
  resultArt: {
    width: 98,
    borderRadius: 7,
    overflow: "hidden",
    minHeight: 98,
  },
  resultCopy: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 3,
    paddingRight: 22,
  },
  resultCategory: {
    color: "#829089",
    fontSize: 7,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  resultTitle: {
    marginTop: 5,
    marginBottom: 7,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
    color: colors.ink,
  },
  resultCreator: {
    color: "#748079",
    fontSize: 8,
    marginRight: 3,
  },
  resultMeta: {
    marginTop: 13,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  resultRating: {
    color: "#6e7a74",
    fontSize: 8,
  },
  resultPrice: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "700",
  },
  resultSave: {
    position: "absolute",
    top: 10,
    right: 10,
    padding: 2,
  },
  empty: {
    paddingVertical: 55,
    paddingHorizontal: 25,
    alignItems: "center",
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "700",
    marginTop: 12,
    marginBottom: 6,
  },
  emptyBody: {
    color: "#7a8780",
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
  },
  emptyButton: {
    marginTop: 14,
    borderRadius: 7,
    backgroundColor: colors.ink,
    paddingHorizontal: 15,
    paddingVertical: 11,
  },
  emptyButtonText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: "700",
  },
  avatar: {
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontWeight: "800",
    color: colors.ink,
  },
  hScroll: {
    paddingRight: 20,
  },
  searchTrigger: {
    minHeight: 53,
    borderWidth: 1,
    borderColor: "#d4d9d0",
    borderRadius: 9,
    backgroundColor: colors.white,
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  searchTriggerText: {
    color: colors.soft,
    fontSize: 13,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
});
