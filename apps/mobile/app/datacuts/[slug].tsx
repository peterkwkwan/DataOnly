import { LICENSE_SUMMARIES, LICENSE_TEMPLATE_VERSION } from "@dataonly/core";
import * as Linking from "expo-linking";
import { Stack, router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Art, Glyph, Screen, VerifiedBadge } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useSaved } from "@/context/SavedContext";
import {
  ApiError,
  checkEntitlement,
  confirmCheckout,
  createCheckoutSession,
  isApiConfigured,
  requestAccess,
  type AccessPayload,
} from "@/lib/api";
import { catalog } from "@/lib/catalog";
import { colors } from "@/lib/theme";

WebBrowser.maybeCompleteAuthSession();

const CHECKOUT_UNAVAILABLE =
  "Checkout isn’t available for this listing right now. Try again later or contact the creator.";

export default function DatacutDetailScreen() {
  const { slug, checkout, session_id } = useLocalSearchParams<{
    slug: string;
    checkout?: string;
    session_id?: string;
  }>();
  const cut = typeof slug === "string" ? catalog.getDatacutBySlug(slug) : undefined;
  const creator = cut ? catalog.getCreators().find((c) => c.id === cut.creatorId) : undefined;
  const { isSaved, toggleSaved } = useSaved();
  const { user, configured: authConfigured, loading: authLoading } = useAuth();
  const [buyOpen, setBuyOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [entitled, setEntitled] = useState(false);
  const [accessRevoked, setAccessRevoked] = useState(false);
  const [entitlementLoading, setEntitlementLoading] = useState(false);
  const [accessBusy, setAccessBusy] = useState(false);
  const [access, setAccess] = useState<AccessPayload | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);

  const refreshEntitlement = useCallback(async () => {
    if (!cut || !authConfigured || !user || !isApiConfigured()) {
      setEntitled(false);
      setAccessRevoked(false);
      return;
    }
    setEntitlementLoading(true);
    try {
      const data = await checkEntitlement(cut.id);
      setEntitled(!!data.entitled);
      // Refunded → same as never bought (Buy). Only admin-revoked stays locked.
      setAccessRevoked(
        !data.entitled && (data.reason === "revoked" || data.status === "revoked"),
      );
    } catch {
      setEntitled(false);
      setAccessRevoked(false);
    } finally {
      setEntitlementLoading(false);
    }
  }, [authConfigured, cut, user]);

  useEffect(() => {
    if (authLoading) return;
    void refreshEntitlement();
  }, [authLoading, refreshEntitlement]);

  // Deep-link / AuthSession return: ?checkout=success|cancel&session_id=
  useEffect(() => {
    if (!cut) return;
    const status = typeof checkout === "string" ? checkout : undefined;
    if (status === "cancel") {
      setBanner("Checkout canceled — no charge was made.");
      return;
    }
    if (status !== "success") return;

    const sessionId = typeof session_id === "string" ? session_id : "";
    let cancelled = false;

    async function confirmAndRefresh() {
      setBanner("Payment received. Activating access…");
      if (sessionId.startsWith("cs_") && authConfigured && user && isApiConfigured()) {
        try {
          await confirmCheckout(sessionId);
          if (!cancelled) setBanner("Payment received. Access is active.");
        } catch {
          if (!cancelled) {
            setBanner(
              "Payment received. Access usually activates within a few seconds — pull to refresh if it doesn’t.",
            );
          }
        }
      } else if (!cancelled) {
        setBanner("Payment received. Access usually activates within a few seconds.");
      }
      if (!cancelled) await refreshEntitlement();
    }

    void confirmAndRefresh();
    return () => {
      cancelled = true;
    };
  }, [authConfigured, checkout, cut, refreshEntitlement, session_id, user]);

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

  const datacut = cut;
  const saved = isSaved(datacut.id);
  const summary = LICENSE_SUMMARIES[datacut.license];
  const apiReady = isApiConfigured();

  async function startCheckout() {
    setError(null);
    if (!authConfigured) {
      setError("Sign in isn’t available right now. Try again later.");
      return;
    }
    if (!user) {
      setBuyOpen(false);
      router.push(`/auth/sign-in?next=/datacuts/${datacut.slug}`);
      return;
    }
    if (!apiReady) {
      setError("Set EXPO_PUBLIC_API_URL to your web app origin (e.g. http://localhost:3000).");
      return;
    }

    setBusy(true);
    try {
      const mobileReturnUrl = Linking.createURL(`/datacuts/${datacut.slug}`);
      const { url } = await createCheckoutSession({
        datacutId: datacut.id,
        mobileReturnUrl,
      });
      if (!url) {
        setError(CHECKOUT_UNAVAILABLE);
        return;
      }

      setBuyOpen(false);
      const result = await WebBrowser.openAuthSessionAsync(url, mobileReturnUrl);

      if (result.type === "success" && result.url) {
        const returned = Linking.parse(result.url);
        const status =
          typeof returned.queryParams?.checkout === "string"
            ? returned.queryParams.checkout
            : undefined;
        const sessionId =
          typeof returned.queryParams?.session_id === "string"
            ? returned.queryParams.session_id
            : "";

        if (status === "cancel") {
          setBanner("Checkout canceled — no charge was made.");
        } else if (status === "success") {
          setBanner("Payment received. Activating access…");
          if (sessionId.startsWith("cs_")) {
            try {
              await confirmCheckout(sessionId);
              setBanner("Payment received. Access is active.");
            } catch {
              setBanner(
                "Payment received. Access usually activates within a few seconds — try Download again shortly.",
              );
            }
          }
          await refreshEntitlement();
        } else {
          await refreshEntitlement();
        }
      } else {
        // User dismissed the browser — entitlement may still have been created via webhook.
        await refreshEntitlement();
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "already_entitled") {
          setError("You already own this datacut.");
          await refreshEntitlement();
        } else if (err.code === "auth_required") {
          setError("Sign in required to purchase.");
        } else if (
          err.code === "stripe_not_configured" ||
          err.code === "creator_not_onboarded" ||
          err.code === "api_not_configured"
        ) {
          setError(
            err.code === "api_not_configured"
              ? "Set EXPO_PUBLIC_API_URL to your web app origin."
              : CHECKOUT_UNAVAILABLE,
          );
        } else {
          setError(err.message || CHECKOUT_UNAVAILABLE);
        }
      } else {
        setError(CHECKOUT_UNAVAILABLE);
      }
    } finally {
      setBusy(false);
    }
  }

  async function downloadFile() {
    setAccessError(null);
    setAccessBusy(true);
    try {
      const data = await requestAccess(datacut.id);
      setAccess(data);
      if (data.delivery.mode === "signed_url" && data.delivery.url) {
        await Linking.openURL(data.delivery.url);
      } else {
        setAccessError(data.delivery.note ?? "No downloadable file yet");
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setAccessError(err.message);
        const body = err.body as AccessPayload | null;
        if (body?.access === "granted") setAccess(body);
      } else {
        setAccessError(err instanceof Error ? err.message : "Download failed");
      }
    } finally {
      setAccessBusy(false);
    }
  }

  function primaryCta() {
    if (entitled) {
      return (
        <Pressable
          style={[styles.buy, accessBusy && styles.buyDisabled]}
          disabled={accessBusy}
          onPress={() => void downloadFile()}
        >
          {accessBusy ? (
            <ActivityIndicator color={colors.signal} />
          ) : (
            <Text style={styles.buyText}>Download</Text>
          )}
        </Pressable>
      );
    }
    if (accessRevoked) {
      return (
        <Pressable style={[styles.buy, styles.buyDisabled]} disabled>
          <Text style={styles.buyText}>Access revoked</Text>
        </Pressable>
      );
    }
    return (
      <Pressable
        style={[styles.buy, (busy || entitlementLoading) && styles.buyDisabled]}
        disabled={busy || entitlementLoading}
        onPress={() => {
          setError(null);
          if (!user) {
            router.push(`/auth/sign-in?next=/datacuts/${datacut.slug}`);
            return;
          }
          setBuyOpen(true);
        }}
      >
        <Text style={styles.buyText}>{user ? "Buy" : "Sign in to buy"}</Text>
      </Pressable>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: datacut.title }} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.hero, { backgroundColor: datacut.accent }]}>
          <Art type={datacut.art} />
          <Pressable
            style={[styles.save, saved && styles.saveOn]}
            onPress={() => toggleSaved(datacut.id)}
          >
            <Glyph name="bookmark" size={16} color={saved ? colors.signal : colors.ink} filled={saved} />
          </Pressable>
        </View>

        <View style={styles.body}>
          <Text style={styles.category}>{datacut.categoryName}</Text>
          <Text style={styles.title}>{datacut.title}</Text>

          <Pressable
            style={styles.creatorRow}
            onPress={() => creator && router.push(`/creators/${creator.slug}`)}
          >
            <Text style={styles.creatorName}>{datacut.creatorName}</Text>
            {creator?.verified ? <VerifiedBadge /> : null}
          </Pressable>

          <Text style={styles.description}>{datacut.description}</Text>

          <View style={styles.facts}>
            <Fact label="Price" value={`$${datacut.price}`} />
            <Fact label="Rating" value={`${datacut.rating} (${datacut.reviews})`} />
            <Fact label="Records" value={datacut.records} />
            <Fact label="Size" value={datacut.size} />
            <Fact label="Format" value={datacut.format} />
            <Fact label="Updated" value={datacut.updated} />
          </View>

          <View style={styles.license}>
            <Text style={styles.licenseLabel}>LICENSE</Text>
            <Text style={styles.licenseBody}>{datacut.licenseBlurb}</Text>
          </View>

          {banner ? <Text style={styles.banner}>{banner}</Text> : null}
          {accessRevoked && !entitled ? (
            <Text style={styles.banner}>
              Access to this datacut was revoked. Download is no longer available.
            </Text>
          ) : null}
          {accessError ? <Text style={styles.errorText}>{accessError}</Text> : null}
          {access ? (
            <View style={styles.accessCard}>
              <Text style={styles.accessTitle}>
                {access.delivery.mode === "signed_url" ? "Download started" : "Access granted"} ·{" "}
                {access.license.summary.title}
              </Text>
              {access.delivery.fileName ? (
                <Text style={styles.accessMeta}>File: {access.delivery.fileName}</Text>
              ) : null}
              {access.delivery.note ? (
                <Text style={styles.accessMeta}>{access.delivery.note}</Text>
              ) : null}
              <Text style={styles.accessMeta}>
                Format {access.delivery.format} · {access.delivery.size} · {access.delivery.records}{" "}
                records
                {access.delivery.expiresIn
                  ? ` · link expires in ${access.delivery.expiresIn}s`
                  : ""}
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View>
          <Text style={styles.footerLabel}>{entitled ? "Owned" : "Checkout"}</Text>
          <Text style={styles.footerPrice}>${datacut.price}</Text>
        </View>
        {primaryCta()}
      </View>

      <Modal visible={buyOpen} transparent animationType="fade" onRequestClose={() => setBuyOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Review license & pay</Text>
            <Text style={styles.modalBody}>
              <Text style={styles.modalStrong}>{datacut.title}</Text> — ${datacut.price} USD
            </Text>
            <View style={styles.licenseBox}>
              <Text style={styles.licenseBoxTitle}>
                {summary.title} · template {LICENSE_TEMPLATE_VERSION}
              </Text>
              <Text style={styles.licenseBoxBody}>
                Allows: {summary.allows}
              </Text>
              <Text style={styles.licenseBoxBody}>
                Forbids: {summary.forbids}
              </Text>
            </View>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancel}
                disabled={busy}
                onPress={() => setBuyOpen(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalConfirm, busy && styles.buyDisabled]}
                disabled={busy}
                onPress={() => void startCheckout()}
              >
                {busy ? (
                  <ActivityIndicator color={colors.signal} />
                ) : (
                  <Text style={styles.modalConfirmText}>Pay with Stripe</Text>
                )}
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
  banner: {
    marginTop: 14,
    fontSize: 13,
    lineHeight: 19,
    color: "#5e6b65",
  },
  errorText: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 18,
    color: "#b42318",
  },
  accessCard: {
    marginTop: 14,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  accessTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.ink,
  },
  accessMeta: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 17,
    color: "#5e6b65",
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
    minWidth: 120,
    alignItems: "center",
  },
  buyDisabled: {
    opacity: 0.55,
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
  modalStrong: {
    fontWeight: "700",
    color: colors.ink,
  },
  licenseBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.welcome,
    borderWidth: 1,
    borderColor: colors.welcomeLine,
  },
  licenseBoxTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.ink,
  },
  licenseBoxBody: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 17,
    color: "#4d5a54",
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
    justifyContent: "center",
    minHeight: 44,
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
