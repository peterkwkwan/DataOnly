import { NextResponse } from "next/server";
import { isDbPermissionError } from "@/lib/errors";
import { createServiceSupabaseClient, hasServiceRoleKey } from "@/lib/supabase/admin";
import { getAuthedRequest } from "@/lib/supabase/request-auth";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { DATACUT_STORAGE_BUCKET, SIGNED_URL_EXPIRES_SEC } from "@/lib/storage";

type CreatorJoin = { user_id: string } | { user_id: string }[] | null;

function creatorUserId(creators: CreatorJoin): string | null {
  if (!creators) return null;
  if (Array.isArray(creators)) return creators[0]?.user_id ?? null;
  return creators.user_id ?? null;
}

/**
 * Public sample download for a listing.
 * Published + sample path → short-lived signed URL. No auth, no entitlement stamp.
 * Unpublished: owner/admin only. Never signs or returns the full-file storage_path.
 */
export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }
  if (!hasServiceRoleKey()) {
    return NextResponse.json(
      { error: "Storage signing requires SUPABASE_SERVICE_ROLE_KEY", code: "storage_not_configured" },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(request.url);
  const datacutId = Number(searchParams.get("datacutId"));
  if (!Number.isFinite(datacutId) || datacutId <= 0) {
    return NextResponse.json({ error: "datacutId query required" }, { status: 400 });
  }

  const admin = createServiceSupabaseClient();
  const { data: cut, error: cutError } = await admin
    .from("datacuts")
    .select(
      "id, slug, title, status, format, size, records, sample_storage_path, sample_file_name, creators(user_id, name)",
    )
    .eq("id", datacutId)
    .maybeSingle();

  if (cutError) {
    console.error("[samples/access] datacut lookup failed", cutError.message);
    if (isDbPermissionError(cutError)) {
      return NextResponse.json(
        {
          error: cutError.message,
          code: "db_permission",
          hint: "Paste supabase/migrations/20260324000000_service_role_datacuts_grant.sql in the Supabase SQL editor",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: cutError.message }, { status: 500 });
  }
  if (!cut) {
    return NextResponse.json({ error: "Datacut missing" }, { status: 404 });
  }

  if (cut.status !== "published") {
    const { user, supabase } = await getAuthedRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const ownerId = creatorUserId(cut.creators as CreatorJoin);
    let allowed = ownerId === user.id;
    if (!allowed) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      allowed = profile?.role === "admin";
    }
    if (!allowed) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  const samplePath =
    typeof cut.sample_storage_path === "string" ? cut.sample_storage_path.trim() : "";
  const fileName =
    (typeof cut.sample_file_name === "string" && cut.sample_file_name.trim()) ||
    samplePath.split("/").pop() ||
    "sample";

  if (!samplePath) {
    return NextResponse.json(
      {
        error: "This datacut has no sample file",
        code: "sample_missing",
      },
      { status: 404 },
    );
  }

  const { data: signed, error: signError } = await admin.storage
    .from(DATACUT_STORAGE_BUCKET)
    .createSignedUrl(samplePath, SIGNED_URL_EXPIRES_SEC, {
      download: fileName,
    });

  if (signError || !signed?.signedUrl) {
    return NextResponse.json(
      {
        error: signError?.message ?? "Could not create download URL",
        code: "sign_failed",
      },
      { status: 500 },
    );
  }

  const creatorRel = cut.creators;
  const creatorName = Array.isArray(creatorRel)
    ? creatorRel[0]?.name
    : (creatorRel as { name?: string } | null)?.name;

  return NextResponse.json({
    access: "granted",
    kind: "sample",
    delivery: {
      mode: "signed_url",
      url: signed.signedUrl,
      expiresIn: SIGNED_URL_EXPIRES_SEC,
      fileName,
      format: cut.format,
      size: cut.size,
      records: cut.records,
      note: "Sample only — not the full dataset.",
    },
    datacut: {
      id: cut.id,
      slug: cut.slug,
      title: cut.title,
      creatorName: creatorName ?? null,
    },
  });
}
