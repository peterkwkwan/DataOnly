import { createMobileSupabaseClient, isMobileSupabaseConfigured } from "@/lib/supabase";

/**
 * Base URL for the Next.js API (checkout, entitlements, confirm).
 * No trailing slash. Required for real Stripe Checkout on mobile.
 */
export function getApiBaseUrl(): string | null {
  const raw = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, "");
}

export function isApiConfigured(): boolean {
  return Boolean(getApiBaseUrl());
}

async function accessToken(): Promise<string | null> {
  if (!isMobileSupabaseConfigured()) return null;
  const supabase = createMobileSupabaseClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  body: unknown;

  constructor(message: string, status: number, body?: unknown, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
    this.code = code;
  }
}

type ApiFetchOptions = {
  method?: "GET" | "POST";
  body?: unknown;
  auth?: boolean;
};

/**
 * Call the web API with optional Supabase Bearer token (same auth as cookie session on web).
 */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const base = getApiBaseUrl();
  if (!base) {
    throw new ApiError("EXPO_PUBLIC_API_URL is not set", 0, null, "api_not_configured");
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (options.auth !== false) {
    const token = await accessToken();
    if (!token) {
      throw new ApiError("Sign in required", 401, null, "auth_required");
    }
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${base}${path.startsWith("/") ? path : `/${path}`}`, {
    method: options.method ?? (options.body !== undefined ? "POST" : "GET"),
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const raw = await res.text();
  let data: unknown = null;
  if (raw.trim()) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = { error: raw };
    }
  }

  if (!res.ok) {
    const obj = (data ?? {}) as { error?: string; code?: string };
    throw new ApiError(
      obj.error ?? `Request failed (${res.status})`,
      res.status,
      data,
      obj.code,
    );
  }

  return data as T;
}

export type EntitlementCheck = {
  entitled: boolean;
  reason?: string;
  status?: string;
};

export type AccessPayload = {
  access: string;
  delivery: {
    mode: string;
    note?: string;
    url?: string;
    expiresIn?: number;
    fileName?: string;
    format: string;
    size: string;
    records: string;
  };
  license: {
    template: string;
    version: string;
    summary: { title: string; allows: string; forbids: string };
  };
  error?: string;
};

export async function checkEntitlement(datacutId: number): Promise<EntitlementCheck> {
  return apiFetch<EntitlementCheck>(`/api/entitlements/check?datacutId=${datacutId}`);
}

export async function createCheckoutSession(opts: {
  datacutId: number;
  mobileReturnUrl: string;
}): Promise<{ url: string; sessionId: string }> {
  return apiFetch("/api/stripe/checkout", {
    method: "POST",
    body: {
      datacutId: opts.datacutId,
      mobileReturnUrl: opts.mobileReturnUrl,
    },
  });
}

export async function confirmCheckout(sessionId: string): Promise<{ ok: boolean }> {
  return apiFetch("/api/stripe/confirm", {
    method: "POST",
    body: { sessionId },
  });
}

export async function requestAccess(datacutId: number): Promise<AccessPayload> {
  return apiFetch<AccessPayload>(`/api/entitlements/access?datacutId=${datacutId}`);
}
