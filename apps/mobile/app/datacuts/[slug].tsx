import { Stack, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Art, Glyph, Screen, VerifiedBadge } from "@/components/ui";
import { useSaved } from "@/context/SavedContext";
import { catalog } from "@/lib/catalog";
import { colors } from "@/lib/theme";

export default function DatacutDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const cut = typeof slug === "string" ? catalog.getDatacutBySlug(slug) : undefined;
  const creator = cut ? catalog.getCreators().find((c) => c.id === cut.creatorId) : undefined;
  const { isSaved, toggleSaved } = useSaved();
  const [buyOpen, setBuyOpen] = useState(false);

  if (!cut) {
    return (
      <Screen>
        <SafeAreaView style={styles.missing}>
          <Text style={styles.missingTitle}>Datacut not found</Text>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.link}>Go back</Text>
          </Pressable>
        </SafeAreaView>
      </Screen>
    );
  }

  const saved = isSaved(cut.id);

  const confirmPurchase = () => {
    setBuyOpen(false);
    Alert.alert(
      "Purchase confirmed (mock)",
      `${cut.title} is marked as purchased. No charge was made.`,
    );
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: cut.title }} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.hero, { backgroundColor: cut.accent }]}>
          <Art type={cut.art} />
          <Pressable
            style={[styles.save, saved && styles.saveOn]}
            onPress={() => toggleSaved(cut.id)}
          >
            <Glyph name="bookmark" size={16} color={saved ? colors.signal : colors.ink} filled={saved} />
          </Pressable>
        </View>

        <View style={styles.body}>
          <Text style={styles.category}>{cut.categoryName}</Text>
          <Text style={styles.title}>{cut.title}</Text>

          <Pressable
            style={styles.creatorRow}
            onPress={() => creator && router.push(`/creators/${creator.slug}`)}
          >
            <Text style={styles.creatorName}>{cut.creatorName}</Text>
            {creator?.verified ? <VerifiedBadge /> : null}
          </Pressable>

          <Text style={styles.description}>{cut.description}</Text>

          <View style={styles.facts}>
            <Fact label="Price" value={`$${cut.price}`} />
            <Fact label="Rating" value={`${cut.rating} (${cut.reviews})`} />
            <Fact label="Records" value={cut.records} />
            <Fact label="Size" value={cut.size} />
            <Fact label="Format" value={cut.format} />
            <Fact label="Updated" value={cut.updated} />
          </View>

          <View style={styles.license}>
            <Text style={styles.licenseLabel}>LICENSE</Text>
            <Text style={styles.licenseBody}>{cut.licenseBlurb}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View>
          <Text style={styles.footerLabel}>Mock checkout</Text>
          <Text style={styles.footerPrice}>${cut.price}</Text>
        </View>
        <Pressable style={styles.buy} onPress={() => setBuyOpen(true)}>
          <Text style={styles.buyText}>Fake Buy</Text>
        </Pressable>
      </View>

      <Modal visible={buyOpen} transparent animationType="fade" onRequestClose={() => setBuyOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Confirm purchase?</Text>
            <Text style={styles.modalBody}>
              This is a Phase 1 mock. Confirming will not charge a card or create a real entitlement.
            </Text>
            <Text style={styles.modalCut}>{cut.title}</Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancel} onPress={() => setBuyOpen(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalConfirm} onPress={confirmPurchase}>
                <Text style={styles.modalConfirmText}>Confirm ${cut.price}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 110 },
  hero: {
    height: 220,
    position: "relative",
    overflow: "hidden",
  },
  save: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  saveOn: {
    backgroundColor: colors.ink,
  },
  body: {
    padding: 20,
  },
  category: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  title: {
    marginTop: 8,
    fontSize: 26,
    fontWeight: "700",
    letterSpacing: -1.2,
    color: colors.ink,
  },
  creatorRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  creatorName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#5e6b65",
  },
  description: {
    marginTop: 16,
    fontSize: 14,
    lineHeight: 21,
    color: "#4d5a54",
  },
  facts: {
    marginTop: 22,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  fact: {
    width: "47%",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    backgroundColor: colors.white,
    padding: 12,
  },
  factLabel: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  factValue: {
    marginTop: 6,
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700",
  },
  license: {
    marginTop: 18,
    padding: 14,
    borderRadius: 10,
    backgroundColor: colors.welcome,
    borderWidth: 1,
    borderColor: colors.welcomeLine,
  },
  licenseLabel: {
    color: colors.muted,
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 1,
  },
  licenseBody: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 18,
    color: colors.ink,
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.canvasBright,
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  footerLabel: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  footerPrice: {
    marginTop: 2,
    fontSize: 22,
    fontWeight: "700",
    color: colors.ink,
  },
  buy: {
    backgroundColor: colors.ink,
    borderRadius: 10,
    paddingHorizontal: 22,
    paddingVertical: 14,
  },
  buyText: {
    color: colors.signal,
    fontWeight: "800",
    fontSize: 13,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(16,27,24,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.ink,
  },
  modalBody: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 19,
    color: "#5e6b65",
  },
  modalCut: {
    marginTop: 14,
    fontSize: 13,
    fontWeight: "700",
    color: colors.ink,
  },
  modalActions: {
    marginTop: 18,
    flexDirection: "row",
    gap: 10,
  },
  modalCancel: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 9,
    paddingVertical: 12,
    alignItems: "center",
  },
  modalCancelText: {
    fontWeight: "700",
    color: colors.ink,
    fontSize: 12,
  },
  modalConfirm: {
    flex: 1,
    backgroundColor: colors.ink,
    borderRadius: 9,
    paddingVertical: 12,
    alignItems: "center",
  },
  modalConfirmText: {
    fontWeight: "700",
    color: colors.signal,
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
    color: colors.ink,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
});
