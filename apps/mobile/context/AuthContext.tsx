import type { Profile, ProfileRole } from "@dataonly/core";
import { mapProfile, type ProfileRow } from "@dataonly/core";
import type { Session, User } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { createSessionFromUrl } from "@/lib/oauth";
import { createMobileSupabaseClient, isMobileSupabaseConfigured } from "@/lib/supabase";

type AuthContextValue = {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isAdmin: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isMobileSupabaseConfigured();
  const [loading, setLoading] = useState(configured);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const loadProfile = useCallback(
    async (userId: string) => {
      if (!configured) return;
      const supabase = createMobileSupabaseClient();
      const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
      setProfile(data ? mapProfile(data as ProfileRow) : null);
    },
    [configured],
  );

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }
    const supabase = createMobileSupabaseClient();
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session?.user) {
        void loadProfile(data.session.user.id).finally(() => {
          if (mounted) setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (next?.user) {
        void loadProfile(next.user.id);
      } else {
        setProfile(null);
      }
    });

    // Fudget pattern: catch OAuth deep links that AuthSession may miss.
    const linkingSub = Linking.addEventListener("url", ({ url }) => {
      void createSessionFromUrl(url).catch((err) => {
        console.warn("[auth] deep link session failed", err);
      });
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      linkingSub.remove();
    };
  }, [configured, loadProfile]);

  const signOut = useCallback(async () => {
    if (!configured) return;
    const supabase = createMobileSupabaseClient();
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  }, [configured]);

  const refreshProfile = useCallback(async () => {
    if (session?.user) await loadProfile(session.user.id);
  }, [loadProfile, session?.user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      configured,
      loading,
      session,
      user: session?.user ?? null,
      profile,
      isAdmin: (profile?.role as ProfileRole | undefined) === "admin",
      refreshProfile,
      signOut,
    }),
    [configured, loading, session, profile, refreshProfile, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
