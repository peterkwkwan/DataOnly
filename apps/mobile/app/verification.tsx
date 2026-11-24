import {
  EXTRA_INDUSTRIES,
  emptyVerifiedSourceRow,
  ensureCreatorForUser,
  hasAcceptedCreatorTos,
  mapVerification,
  validateVerifiedSources,
  verifiedSourcePlatformLabel,
  VERIFIED_SOURCE_PLATFORMS,
  type Creator,
  type VerificationApplication,
  type VerificationRow,
  type VerifiedSource,
  type VerifiedSourcePlatform,
} from "@dataonly/core";
import { router } from "expo-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PageHeader, Screen } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { createMobileSupabaseClient, isMobileSupabaseConfigured } from "@/lib/supabase";
import { colors } from "@/lib/theme";

const INDUSTRY_OPTIONS = [...EXTRA_INDUSTRIES];

export default function VerificationApplyScreen() {
  const { user, profile, loading, configured, signOut } = useAuth();
  const [creator, setCreator] = useState<Creator | null>(null);
  const [application, setApplication] = useState<VerificationApplication | null>(null);
  const [identity, setIdentity] = useState("");
  const [industries, setIndustries] = useState<string[]>([]);
  const [sources, setSources] = useState<VerifiedSource[]>([emptyVerifiedSourceRow()]);
  const [credentials, setCredentials] = useState("");
  const [attested, setAttested] = useState(false);
  const [industriesOpen, setIndustriesOpen] = useState(false);
  const [platformMenuIndex, setPlatformMenuIndex] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!configured) return;
    if (!user) {
      router.replace({ pathname: "/auth/sign-in", params: { next: "/verification" } });
      return;
    }
    if (!hasAcceptedCreatorTos(profile)) {
      router.replace({ pathname: "/tos", params: { next: "/verification" } });
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        const supabase = createMobileSupabaseClient();
        const ensured = await ensureCreatorForUser(supabase, user!, profile?.displayName);
        if (cancelled) return;
        setCreator(ensured);
        setIdentity(ensured.name);
        const { data } = await supabase
          .from("verification_applications")
          .select("*")
          .eq("creator_id", ensured.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!cancelled && data) {
          const app = mapVerification(data as VerificationRow);
          setApplication(app);
          setIdentity(app.identity || ensured.name);
          setIndustries(app.industries);
          setSources(app.sources.length > 0 ? app.sources : [emptyVerifiedSourceRow()]);
          setCredentials(app.credentials ?? "");
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [configured, loading, profile, user]);

  const locked =
    application?.status === "submitted" ||
    application?.status === "under_review" ||
    application?.status === "approved";

  function toggleIndustry(name: string) {
    setIndustries((current) =>
      current.includes(name) ? current.filter((item) => item !== name) : [...current, name],
    );
  }

  function updateSource(index: number, patch: Partial<VerifiedSource>) {
    setSources((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addSource() {
    setSources((current) => [...current, emptyVerifiedSourceRow()]);
  }

  function removeSource(index: number) {
    setSources((current) => {
      if (current.length <= 1) return current;
      return current.filter((_, i) => i !== index);
    });
  }

  async function onSubmit() {
    if (!creator || !user) return;
    if (!attested) {
      setError("Attestation is required.");
      return;
    }
    if (industries.length === 0) {
      setError("Select at least one industry.");
      return;
    }
    const sourcesResult = validateVerifiedSources(sources);
    if (!sourcesResult.ok) {
      setError(sourcesResult.error);
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const supabase = createMobileSupabaseClient();
      // New application after reject; continue same row for draft / info-request.
      // Always clear prior review fields so SUBMITTED never surfaces stale notes.
      const payload = {
        creator_id: creator.id,
        status: "submitted",
        identity: identity.trim(),
        industries,
        sources: sourcesResult.sources,
        credentials: credentials.trim() || null,
        attestation_accepted_at: new Date().toISOString(),
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        rejection_reason: null,
        info_request_note: null,
        reviewed_at: null,
        reviewed_by: null,
      };
      const continueSameRow =
        application &&
        (application.status === "draft" || application.status === "needs_more_info");
      if (continueSameRow) {
        const { data, error: updateError } = await supabase
          .from("verification_applications")
          .update(payload)
          .eq("id", application.id)
          .select("*")
          .single();
        if (updateError) throw updateError;
        const mapped = mapVerification(data as VerificationRow);
        setApplication(mapped);
        setSources(mapped.sources.length > 0 ? mapped.sources : [emptyVerifiedSourceRow()]);
      } else {
        const { data, error: insertError } = await supabase
          .from("verification_applications")
          .insert(payload)
          .select("*")
          .single();
        if (insertError) throw insertError;
        const mapped = mapVerification(data as VerificationRow);
        setApplication(mapped);
        setSources(mapped.sources.length > 0 ? mapped.sources : [emptyVerifiedSourceRow()]);
      }
      setMessage("Application submitted. An admin will review it.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  }

  if (!configured) {
    return (
      <Screen>
        <SafeAreaView edges={["top"]} style={styles.safe}>
          <View style={styles.pad}>
            <PageHeader kicker="VERIFICATION" title="Apply for Verified" />
            <Text style={styles.body}>
              Configure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY to apply.
            </Text>
          </View>
        </SafeAreaView>
      </Screen>
    );
  }

  if (loading || (!user && configured) || (user && !hasAcceptedCreatorTos(profile))) {
    return (
      <Screen>
        <SafeAreaView edges={["top"]} style={styles.safe}>
          <View style={styles.pad}>
            <Text style={styles.body}>
              {user && !hasAcceptedCreatorTos(profile)
                ? "Redirecting to Creator Terms…"
                : "Loading…"}
            </Text>
          </View>
        </SafeAreaView>
      </Screen>
    );
  }

  const industryTrigger =
    industries.length === 0
      ? "Select industries"
      : industries.length <= 2
        ? industries.join(", ")
        : `${industries.length} selected`;

  return (
    <Screen>
      <SafeAreaView edges={["top"]} style={styles.safe}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <PageHeader kicker="VERIFICATION" title="Apply for Verified" />
            <Text style={styles.body}>
              Verified is a trust boost, not a paywall. Unverified creators can still list and sell.
            </Text>
            {application ? (
              <View style={styles.banner}>
                <Text style={styles.bannerText}>
                  Status: <Text style={styles.bold}>{application.status.toUpperCase()}</Text>
                </Text>
                {application.status === "needs_more_info" && application.infoRequestNote ? (
                  <Text style={styles.bannerText}>Info requested: {application.infoRequestNote}</Text>
                ) : null}
                {application.status === "rejected" && application.rejectionReason ? (
                  <Text style={styles.bannerText}>Rejection: {application.rejectionReason}</Text>
                ) : null}
              </View>
            ) : null}

            <Field label="Legal / display identity">
              <TextInput
                style={styles.input}
                value={identity}
                onChangeText={setIdentity}
                editable={!locked}
                placeholderTextColor={colors.muted}
              />
            </Field>

            <Field label="Industries / expertise">
              <Pressable
                style={styles.selectTrigger}
                disabled={locked}
                onPress={() => {
                  setPlatformMenuIndex(null);
                  setIndustriesOpen((open) => !open);
                }}
              >
                <Text style={[styles.selectValue, industries.length === 0 && styles.placeholder]}>
                  {industryTrigger}
                </Text>
                <Text style={styles.chevron}>{industriesOpen ? "▴" : "▾"}</Text>
              </Pressable>
              {industriesOpen ? (
                <View style={styles.menu}>
                  {INDUSTRY_OPTIONS.map((name) => {
                    const selected = industries.includes(name);
                    return (
                      <Pressable
                        key={name}
                        style={[styles.option, selected && styles.optionSelected]}
                        onPress={() => toggleIndustry(name)}
                      >
                        <Text style={styles.optionLabel}>{name}</Text>
                        {selected ? <Text style={styles.check}>✓</Text> : null}
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
              {industries.length > 0 ? (
                <View style={styles.pills}>
                  {industries.map((name) => (
                    <Pressable
                      key={name}
                      style={styles.pill}
                      disabled={locked}
                      onPress={() => toggleIndustry(name)}
                    >
                      <Text style={styles.pillText}>{name}</Text>
                      {!locked ? <Text style={styles.pillRemove}>×</Text> : null}
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </Field>

            <Field label="Verified sources">
              <Text style={styles.hint}>
                Add YouTube or LinkedIn links. Same platform can be used more than once.
              </Text>
              {sources.map((row, index) => {
                const menuOpen = platformMenuIndex === index;
                return (
                  <View key={index} style={styles.sourceRow}>
                    <Pressable
                      style={styles.selectTrigger}
                      disabled={locked}
                      onPress={() => {
                        setIndustriesOpen(false);
                        setPlatformMenuIndex((current) => (current === index ? null : index));
                      }}
                    >
                      <Text style={styles.selectValue}>
                        {verifiedSourcePlatformLabel(row.platform)}
                      </Text>
                      <Text style={styles.chevron}>{menuOpen ? "▴" : "▾"}</Text>
                    </Pressable>
                    {menuOpen ? (
                      <View style={styles.menu}>
                        {VERIFIED_SOURCE_PLATFORMS.map((option) => {
                          const selected = row.platform === option.id;
                          return (
                            <Pressable
                              key={option.id}
                              style={[styles.option, selected && styles.optionSelected]}
                              onPress={() => {
                                updateSource(index, {
                                  platform: option.id as VerifiedSourcePlatform,
                                });
                                setPlatformMenuIndex(null);
                              }}
                            >
                              <Text style={styles.optionLabel}>{option.label}</Text>
                              {selected ? <Text style={styles.check}>✓</Text> : null}
                            </Pressable>
                          );
                        })}
                      </View>
                    ) : null}
                    <TextInput
                      style={styles.input}
                      value={row.url}
                      onChangeText={(url) => updateSource(index, { url })}
                      editable={!locked}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="url"
                      placeholder="https://"
                      placeholderTextColor={colors.muted}
                    />
                    {!locked && sources.length > 1 ? (
                      <Pressable onPress={() => removeSource(index)}>
                        <Text style={styles.linkButton}>Remove</Text>
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
              {!locked ? (
                <Pressable onPress={addSource}>
                  <Text style={styles.linkButton}>+ Add source</Text>
                </Pressable>
              ) : null}
            </Field>

            <Field label="Credentials (optional)">
              <TextInput
                style={[styles.input, styles.textarea]}
                value={credentials}
                onChangeText={setCredentials}
                editable={!locked}
                multiline
                placeholderTextColor={colors.muted}
              />
            </Field>

            <View style={styles.attestRow}>
              <Switch
                value={attested}
                onValueChange={setAttested}
                disabled={locked}
                trackColor={{ false: colors.line, true: colors.signal }}
              />
              <Text style={styles.attestText}>
                I attest that this information is true and that I own or have rights to the claims
                made.
              </Text>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}
            {message ? <Text style={styles.success}>{message}</Text> : null}

            <Pressable
              style={[styles.primary, (busy || locked || industries.length === 0) && styles.disabled]}
              disabled={busy || locked || industries.length === 0}
              onPress={() => void onSubmit()}
            >
              <Text style={styles.primaryText}>
                {locked ? "Submitted" : busy ? "Submitting…" : "Submit application"}
              </Text>
            </Pressable>

            <Pressable
              style={styles.secondary}
              onPress={() => {
                void signOut().then(() => router.replace("/"));
              }}
            >
              <Text style={styles.secondaryText}>Sign out</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Screen>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  pad: { padding: 20, gap: 12 },
  scroll: { padding: 20, paddingBottom: 64, gap: 16 },
  body: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  banner: {
    backgroundColor: colors.welcome,
    borderRadius: 16,
    padding: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.welcomeLine,
  },
  bannerText: { color: colors.ink, fontSize: 14 },
  bold: { fontWeight: "700" },
  field: { gap: 8 },
  label: { color: colors.muted, fontSize: 13, fontWeight: "600" },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.ink,
    fontSize: 16,
  },
  textarea: { minHeight: 88, textAlignVertical: "top" },
  selectTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  selectValue: { color: colors.ink, fontSize: 15, flex: 1 },
  placeholder: { color: colors.muted },
  chevron: { color: colors.muted, marginLeft: 8 },
  menu: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    backgroundColor: colors.white,
    overflow: "hidden",
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  optionSelected: { backgroundColor: colors.welcome },
  optionLabel: { color: colors.ink, fontSize: 15 },
  check: { color: colors.muted, fontSize: 14 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    backgroundColor: colors.welcome,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pillText: { color: colors.ink, fontSize: 13 },
  pillRemove: { color: colors.muted, fontSize: 14 },
  sourceRow: { gap: 8 },
  linkButton: { color: colors.ink, fontWeight: "600", fontSize: 14, paddingVertical: 4 },
  attestRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  attestText: { flex: 1, color: colors.ink, fontSize: 14, lineHeight: 20 },
  primary: {
    marginTop: 4,
    backgroundColor: colors.ink,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryText: { color: colors.signal, fontWeight: "700", fontSize: 15 },
  secondary: { alignItems: "center", paddingVertical: 10 },
  secondaryText: { color: colors.ink, fontWeight: "600" },
  disabled: { opacity: 0.55 },
  error: { color: "#b42318", fontSize: 14 },
  success: { color: "#067647", fontSize: 14 },
});
