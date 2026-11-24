import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PageHeader, Screen } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { createMobileSupabaseClient, isMobileSupabaseConfigured } from "@/lib/supabase";
import { colors } from "@/lib/theme";

type PasswordIntent = "sign-in" | "create";

export default function SignInScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams<{ next?: string }>();
  const next = typeof params.next === "string" ? params.next : "/verification";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordIntent, setPasswordIntent] = useState<PasswordIntent>("sign-in");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const creating = passwordIntent === "create";

  useEffect(() => {
    if (user) router.replace(next as "/verification");
  }, [next, user]);

  function switchIntent(nextIntent: PasswordIntent) {
    setPasswordIntent(nextIntent);
    setError(null);
    setMessage(null);
  }

  async function onSubmit() {
    setError(null);
    setMessage(null);
    if (!isMobileSupabaseConfigured()) {
      setError(
        creating
          ? "Supabase is not configured."
          : "Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
      );
      return;
    }
    setBusy(true);
    try {
      const supabase = createMobileSupabaseClient();
      if (passwordIntent === "create") {
        const { error: signError } = await supabase.auth.signUp({ email, password });
        if (signError) throw signError;
        setMessage("Account created. Confirm email if required, then sign in.");
        setPasswordIntent("sign-in");
      } else {
        // Sign-in mode only — never call signUp here.
        const { error: signError } = await supabase.auth.signInWithPassword({ email, password });
        if (signError) throw signError;
        router.replace(next as "/verification");
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : creating
            ? "Sign-up failed"
            : "Sign-in failed",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <SafeAreaView edges={["top"]} style={styles.safe}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <PageHeader
              kicker="ACCOUNT"
              title={creating ? "Create account" : "Sign in"}
            />
            <Text style={styles.body}>
              {creating
                ? "Create a new email + password account to apply for Verified on mobile."
                : "Sign in with email and password to apply for Verified on mobile."}
            </Text>
            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={colors.muted}
                autoComplete="email"
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={colors.muted}
                autoComplete={creating ? "new-password" : "password"}
              />
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {message ? <Text style={styles.success}>{message}</Text> : null}
            <Pressable
              style={[styles.primary, busy && styles.disabled]}
              disabled={busy}
              onPress={() => void onSubmit()}
            >
              <Text style={styles.primaryText}>
                {busy ? "Working…" : creating ? "Create account" : "Sign in"}
              </Text>
            </Pressable>
            <Pressable
              style={styles.secondary}
              disabled={busy}
              onPress={() => switchIntent(creating ? "sign-in" : "create")}
            >
              <Text style={styles.secondaryText}>
                {creating
                  ? "Already have an account? Sign in"
                  : "Need an account? Create account"}
              </Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 48, gap: 14 },
  body: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  field: { gap: 6 },
  label: { color: colors.muted, fontSize: 13, fontWeight: "600" },
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
  primary: {
    marginTop: 8,
    backgroundColor: colors.ink,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryText: { color: colors.signal, fontWeight: "700", fontSize: 15 },
  secondary: { alignItems: "center", paddingVertical: 10 },
  secondaryText: { color: colors.ink, fontWeight: "600" },
  disabled: { opacity: 0.6 },
  error: { color: "#b42318", fontSize: 14 },
  success: { color: "#067647", fontSize: 14 },
});
