import {
  CREATOR_TOS_ACCEPT_LABEL,
  CREATOR_TOS_DRAFT_NOTICE,
  CREATOR_TOS_SECTIONS,
  CREATOR_TOS_VERSION,
  acceptCreatorTos,
  ensureCreatorForUser,
  hasAcceptedCreatorTos,
} from "@dataonly/core";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PageHeader, Screen } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { createMobileSupabaseClient, isMobileSupabaseConfigured } from "@/lib/supabase";
import { colors } from "@/lib/theme";

function safeNextPath(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/verification";
  if (value.startsWith("/tos")) return "/verification";
  return value;
}

export default function CreatorTosScreen() {
  const { user, profile, loading, configured, refreshProfile } = useAuth();
  const params = useLocalSearchParams<{ next?: string }>();
  const nextPath = safeNextPath(params.next);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const alreadyAccepted = hasAcceptedCreatorTos(profile);

  async function onAccept() {
    if (!user || !checked || busy) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = createMobileSupabaseClient();
      await ensureCreatorForUser(supabase, user, profile?.displayName);
      await acceptCreatorTos(supabase, user.id);
      await refreshProfile();
      router.replace(nextPath as "/verification");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record ToS acceptance");
      setBusy(false);
    }
  }

  if (!configured || !isMobileSupabaseConfigured()) {
    return (
      <Screen>
        <SafeAreaView edges={["top"]} style={styles.safe}>
          <View style={styles.pad}>
            <PageHeader kicker="CREATOR TERMS" title="Connect Supabase first" />
            <Text style={styles.body}>
              Configure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, then run
              the Creator ToS migration.
            </Text>
          </View>
        </SafeAreaView>
      </Screen>
    );
  }

  if (loading) {
    return (
      <Screen>
        <SafeAreaView edges={["top"]} style={styles.safe}>
          <View style={styles.pad}>
            <Text style={styles.body}>Loading…</Text>
          </View>
        </SafeAreaView>
      </Screen>
    );
  }

  if (!user) {
    return (
      <Screen>
        <SafeAreaView edges={["top"]} style={styles.safe}>
          <View style={styles.pad}>
            <PageHeader kicker="CREATOR TERMS" title="Sign in required" />
            <Text style={styles.body}>Accept Creator Terms after signing in.</Text>
            <Pressable
              style={styles.primary}
              onPress={() =>
                router.push({ pathname: "/auth/sign-in", params: { next: "/tos" } })
              }
            >
              <Text style={styles.primaryText}>Sign in</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Screen>
    );
  }

  return (
    <Screen>
      <SafeAreaView edges={["top"]} style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <PageHeader kicker="CREATOR ONBOARDING" title="Creator Terms of Service" />
          <Text style={styles.body}>
            Accept these terms before applying for Verified or acting as a creator. Listing license
            templates (Personal / Commercial) are separate from this gate.
          </Text>

          <View style={styles.draftBanner}>
            <Text style={styles.draftText}>{CREATOR_TOS_DRAFT_NOTICE}</Text>
          </View>
          <Text style={styles.meta}>Version {CREATOR_TOS_VERSION}</Text>

          {CREATOR_TOS_SECTIONS.map((section) => (
            <View key={section.title} style={styles.card}>
              <Text style={styles.cardTitle}>{section.title}</Text>
              <Text style={styles.cardBody}>{section.body}</Text>
            </View>
          ))}

          {alreadyAccepted ? (
            <Pressable style={styles.primary} onPress={() => router.replace(nextPath as "/verification")}>
              <Text style={styles.primaryText}>Continue</Text>
            </Pressable>
          ) : (
            <>
              <View style={styles.checkRow}>
                <Switch value={checked} onValueChange={setChecked} />
                <Text style={styles.checkLabel}>{CREATOR_TOS_ACCEPT_LABEL}</Text>
              </View>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Pressable
                style={[styles.primary, (!checked || busy) && styles.primaryDisabled]}
                disabled={!checked || busy}
                onPress={() => void onAccept()}
              >
                <Text style={styles.primaryText}>{busy ? "Saving…" : "Accept Creator Terms"}</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  pad: { padding: 20, gap: 12 },
  scroll: { padding: 20, paddingBottom: 48, gap: 14 },
  body: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  draftBanner: {
    backgroundColor: colors.welcome,
    borderColor: colors.welcomeLine,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  draftText: { color: colors.ink, fontWeight: "700", fontSize: 13, lineHeight: 18 },
  meta: { color: colors.soft, fontSize: 12 },
  card: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  cardTitle: { color: colors.ink, fontSize: 16, fontWeight: "700" },
  cardBody: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  checkRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginTop: 4 },
  checkLabel: { flex: 1, color: colors.ink, fontSize: 14, lineHeight: 20 },
  error: { color: "#b42318", fontSize: 14 },
  primary: {
    marginTop: 8,
    backgroundColor: colors.ink,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryDisabled: { opacity: 0.45 },
  primaryText: { color: colors.signal, fontWeight: "700", fontSize: 15 },
});
