import { NextResponse } from "next/server";
import {
  isCreatorConnectReady,
  PUBLISH_REQUIRES_PAYOUTS,
} from "@/lib/stripe/connect-ready";
import { createServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const runtime = "nodejs";

type ListingBody = {
  id?: number;
  title?: string;
  slug?: string;
  creator_id?: string;
  category_id?: string;
  price?: number;
  size?: string;
  records?: string;
  format?: string;
  license?: string;
  description?: string;
  status?: string;
  accent?: string;
  art?: string;
  updated_label?: string;
};

/**
 * Create or update a datacut. Publish requires Connect ready
 * (stripe_account_id + stripe_charges_enabled) — same gate as Checkout.
 * Drafts and unpublish are always allowed.
 */
export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase not configured", code: "supabase_not_configured" },
      { status: 503 },
    );
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  let body: ListingBody;
  try {
    body = (await request.json()) as ListingBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const creatorId = typeof body.creator_id === "string" ? body.creator_id.trim() : "";
  if (!creatorId) {
    return NextResponse.json({ error: "creator_id required" }, { status: 400 });
  }

  const { data: creator, error: creatorError } = await supabase
    .from("creators")
    .select("id, user_id, stripe_account_id, stripe_charges_enabled")
    .eq("id", creatorId)
    .maybeSingle();

  if (creatorError) {
    return NextResponse.json({ error: creatorError.message }, { status: 500 });
  }
  if (!creator || creator.user_id !== user.id) {
    return NextResponse.json({ error: "Not your creator profile" }, { status: 403 });
  }

  const status = typeof body.status === "string" ? body.status : "draft";
  if (
    status === "published" &&
    !isCreatorConnectReady(creator.stripe_account_id, creator.stripe_charges_enabled)
  ) {
    return NextResponse.json(
      {
        error: PUBLISH_REQUIRES_PAYOUTS,
        code: "connect_not_ready",
      },
      { status: 409 },
    );
  }

  const payload = {
    title: body.title,
    slug: body.slug,
    creator_id: creatorId,
    category_id: body.category_id,
    price: body.price,
    size: body.size,
    records: body.records,
    format: body.format,
    license: body.license,
    description: body.description,
    status,
    accent: body.accent,
    art: body.art,
    updated_label: body.updated_label,
    updated_at: new Date().toISOString(),
  };

  const listingId = typeof body.id === "number" && Number.isFinite(body.id) ? body.id : null;

  if (listingId != null) {
    const { data, error } = await supabase
      .from("datacuts")
      .update(payload)
      .eq("id", listingId)
      .eq("creator_id", creatorId)
      .select("id")
      .maybeSingle();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }
    return NextResponse.json({ id: Number(data.id) });
  }

  const { data, error } = await supabase
    .from("datacuts")
    .insert(payload)
    .select("id")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ id: Number(data.id) });
}
