import { NextResponse } from "next/server";
import { createServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  if (isSupabaseConfigured()) {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.signOut();
  }
  return NextResponse.redirect(`${origin}/`, { status: 303 });
}

export async function GET(request: Request) {
  return POST(request);
}
