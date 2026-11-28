import {
  mapReview,
  validateReviewInput,
  type ReviewRow,
} from "@dataonly/core";
import { NextResponse } from "next/server";
import { createServiceSupabaseClient, hasServiceRoleKey } from "@/lib/supabase/admin";
import { createServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const runtime = "nodejs";

const LIST_LIMIT = 20;

function unavailable() {
  return NextResponse.json(
    { error: "Supabase not configured", code: "supabase_not_configured" },
    { status: 503 },
  );
}

type WriteBody = {
  datacutId?: number;
  rating?: number;
  body?: string | null;
  visible?: boolean;
};

type HideBody = {
  id?: string;
  visible?: boolean;
};

/** Public list of visible reviews (+ caller's own row when signed in). */
export async function GET(request: Request) {
  if (!isSupabaseConfigured() || !hasServiceRoleKey()) return unavailable();

  const { searchParams } = new URL(request.url);
  const datacutId = Number(searchParams.get("datacutId"));
  if (!Number.isFinite(datacutId) || datacutId <= 0) {
    return NextResponse.json({ error: "datacutId query required" }, { status: 400 });
  }

  const admin = createServiceSupabaseClient();
  const { data, error } = await admin
    .from("reviews")
    .select("id, user_id, datacut_id, rating, body, visible, created_at, updated_at")
    .eq("datacut_id", datacutId)
    .eq("visible", true)
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as ReviewRow[];
  const userIds = [...new Set(rows.map((r) => r.user_id))];

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let mine: ReturnType<typeof mapReview> | null = null;
  if (user) {
    const { data: own, error: ownError } = await admin
      .from("reviews")
      .select("id, user_id, datacut_id, rating, body, visible, created_at, updated_at")
      .eq("datacut_id", datacutId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (ownError) {
      return NextResponse.json({ error: ownError.message }, { status: 500 });
    }
    if (own) {
      mine = mapReview(own as ReviewRow);
      if (!userIds.includes(user.id)) userIds.push(user.id);
    }
  }

  const nameByUser = new Map<string, string | null>();
  if (userIds.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, display_name")
      .in("id", userIds);
    for (const p of profiles ?? []) {
      const name =
        typeof p.display_name === "string" ? p.display_name.trim() || null : null;
      nameByUser.set(p.id as string, name);
    }
  }

  const reviews = rows.map((row) =>
    mapReview(row, nameByUser.get(row.user_id) ?? null),
  );
  if (mine) {
    mine = {
      ...mine,
      displayName: nameByUser.get(mine.userId) ?? null,
    };
  }

  const { data: cut } = await admin
    .from("datacuts")
    .select("rating, reviews")
    .eq("id", datacutId)
    .maybeSingle();

  return NextResponse.json({
    reviews,
    mine,
    summary: {
      rating: cut ? Number(cut.rating) : 0,
      count: cut ? Number(cut.reviews) : 0,
    },
  });
}

/** Upsert own review while entitlement is active. */
export async function POST(request: Request) {
  if (!isSupabaseConfigured() || !hasServiceRoleKey()) return unavailable();

  let body: WriteBody;
  try {
    body = (await request.json()) as WriteBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validated = validateReviewInput({
    datacutId: body.datacutId,
    rating: body.rating,
    body: body.body,
    visible: body.visible,
  });
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error, code: "invalid" }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required", code: "auth_required" }, { status: 401 });
  }

  const admin = createServiceSupabaseClient();
  const { data: entitlement, error: entError } = await admin
    .from("entitlements")
    .select("status")
    .eq("user_id", user.id)
    .eq("datacut_id", body.datacutId)
    .maybeSingle();

  if (entError) {
    return NextResponse.json({ error: entError.message }, { status: 500 });
  }
  if (!entitlement || entitlement.status !== "active") {
    return NextResponse.json(
      { error: "Buy this datacut to leave a rating", code: "not_entitled" },
      { status: 403 },
    );
  }

  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("reviews")
    .upsert(
      {
        user_id: user.id,
        datacut_id: body.datacutId,
        rating: validated.rating,
        body: validated.body,
        visible: validated.visible,
        updated_at: now,
      },
      { onConflict: "user_id,datacut_id" },
    )
    .select("id, user_id, datacut_id, rating, body, visible, created_at, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: cut } = await admin
    .from("datacuts")
    .select("rating, reviews")
    .eq("id", body.datacutId)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    review: mapReview(data as ReviewRow),
    summary: {
      rating: cut ? Number(cut.rating) : 0,
      count: cut ? Number(cut.reviews) : 0,
    },
  });
}

/** Admin hide (or re-show). Does not require entitlement. */
export async function PATCH(request: Request) {
  if (!isSupabaseConfigured() || !hasServiceRoleKey()) return unavailable();

  let body: HideBody;
  try {
    body = (await request.json()) as HideBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const id = body.id?.trim() || "";
  if (!id) {
    return NextResponse.json({ error: "id is required", code: "id_required" }, { status: 400 });
  }
  if (body.visible !== false && body.visible !== true) {
    return NextResponse.json(
      { error: "visible must be true or false", code: "invalid" },
      { status: 400 },
    );
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required", code: "auth_required" }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Admin only", code: "forbidden" }, { status: 403 });
  }

  const admin = createServiceSupabaseClient();
  const { data, error } = await admin
    .from("reviews")
    .update({
      visible: body.visible,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id, user_id, datacut_id, rating, body, visible, created_at, updated_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Review not found", code: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, review: mapReview(data as ReviewRow) });
}
