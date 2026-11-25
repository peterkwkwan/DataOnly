import {
  LICENSE_SUMMARIES,
  mapEntitlement,
  type EntitlementRow,
} from "@dataonly/core";
import { NextResponse } from "next/server";
import { createServiceSupabaseClient, hasServiceRoleKey } from "@/lib/supabase/admin";
import { createServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { DATACUT_STORAGE_BUCKET, SIGNED_URL_EXPIRES_SEC } from "@/lib/storage";

/**
 * Gated download for a purchased datacut.
 * Requires an active entitlement for the signed-in user, then mints a short-lived
 * Supabase Storage signed URL (service role) for the private object.
 */
export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const datacutId = Number(searchParams.get("datacutId"));
  if (!Number.isFinite(datacutId) || datacutId <= 0) {
    return NextResponse.json({ error: "datacutId query required" }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required", code: "auth_required" }, { status: 401 });
  }

  const { data: entitlementRow, error: entError } = await supabase
    .from("entitlements")
    .select("*")
    .eq("user_id", user.id)
    .eq("datacut_id", datacutId)
    .maybeSingle();

  if (entError) {
    return NextResponse.json({ error: entError.message }, { status: 500 });
  }
  if (!entitlementRow || entitlementRow.status !== "active") {
    const status =
      entitlementRow && typeof entitlementRow.status === "string"
        ? entitlementRow.status
        : null;
    if (status === "refunded" || status === "revoked") {
      return NextResponse.json(
        {
          error:
            status === "refunded"
              ? "This purchase was refunded. Download is no longer available."
              : "Access to this datacut was revoked.",
          code: status,
          access: "denied",
        },
        { status: 403 },
      );
    }
    return NextResponse.json(
      { error: "Purchase required to access this datacut", code: "not_entitled" },
      { status: 403 },
    );
  }

  const { data: cut, error: cutError } = await supabase
    .from("datacuts")
    .select(
      "id, slug, title, format, size, records, license, description, storage_path, file_name, creators(name)",
    )
    .eq("id", datacutId)
    .maybeSingle();

  if (cutError || !cut) {
    return NextResponse.json({ error: cutError?.message ?? "Datacut missing" }, { status: 404 });
  }

  const entitlement = mapEntitlement(entitlementRow as EntitlementRow);
  const creatorRel = cut.creators;
  const creatorName = Array.isArray(creatorRel)
    ? creatorRel[0]?.name
    : (creatorRel as { name?: string } | null)?.name;

  const storagePath = typeof cut.storage_path === "string" ? cut.storage_path.trim() : "";
  const fileName =
    (typeof cut.file_name === "string" && cut.file_name.trim()) ||
    storagePath.split("/").pop() ||
    "download";

  if (!storagePath) {
    return NextResponse.json(
      {
        error: "This datacut has no downloadable file yet",
        code: "file_missing",
        access: "granted",
        delivery: {
          mode: "unavailable",
          note: "Entitlement is active, but the creator has not uploaded a file.",
          format: cut.format,
          size: cut.size,
          records: cut.records,
        },
        datacut: {
          id: cut.id,
          slug: cut.slug,
          title: cut.title,
          creatorName: creatorName ?? null,
          description: cut.description,
        },
        license: {
          template: entitlement.license,
          version: entitlement.licenseVersion,
          summary: LICENSE_SUMMARIES[entitlement.license],
        },
        entitlement: {
          id: entitlement.id,
          purchasedAt: entitlement.createdAt,
          amountCents: entitlement.amountCents,
          currency: entitlement.currency,
        },
      },
      { status: 404 },
    );
  }

  if (!hasServiceRoleKey()) {
    return NextResponse.json(
      {
        error: "Storage signing requires SUPABASE_SERVICE_ROLE_KEY",
        code: "storage_not_configured",
      },
      { status: 503 },
    );
  }

  const admin = createServiceSupabaseClient();
  const { data: signed, error: signError } = await admin.storage
    .from(DATACUT_STORAGE_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_EXPIRES_SEC, {
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

  return NextResponse.json({
    access: "granted",
    delivery: {
      mode: "signed_url",
      url: signed.signedUrl,
      expiresIn: SIGNED_URL_EXPIRES_SEC,
      fileName,
      format: cut.format,
      size: cut.size,
      records: cut.records,
    },
    datacut: {
      id: cut.id,
      slug: cut.slug,
      title: cut.title,
      creatorName: creatorName ?? null,
      description: cut.description,
    },
    license: {
      template: entitlement.license,
      version: entitlement.licenseVersion,
      summary: LICENSE_SUMMARIES[entitlement.license],
    },
    entitlement: {
      id: entitlement.id,
      purchasedAt: entitlement.createdAt,
      amountCents: entitlement.amountCents,
      currency: entitlement.currency,
    },
  });
}
