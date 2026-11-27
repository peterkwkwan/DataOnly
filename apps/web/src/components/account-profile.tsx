"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/context/auth-context";
import { formatClientError } from "@/lib/errors";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { initialsFrom, mapCreator, type Creator, type CreatorRow } from "@dataonly/core";

export function AccountProfile({
  userId,
  creator,
  onSaved,
}: {
  userId: string;
  creator: Creator;
  onSaved: (creator: Creator) => void;
}) {
  const { refreshProfile } = useAuth();
  const [name, setName] = useState(creator.name);
  const [bio, setBio] = useState(creator.bio);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function clearStatus() {
    setError(null);
    setMessage(null);
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const nextName = name.trim();
    const nextBio = bio.trim();
    if (!nextName) {
      setError("Display name is required.");
      setMessage(null);
      return;
    }
    if (nextName.length > 80) {
      setError("Keep the display name under 80 characters.");
      setMessage(null);
      return;
    }
    if (nextBio.length > 500) {
      setError("Keep the bio under 500 characters.");
      setMessage(null);
      return;
    }

    setBusy(true);
    clearStatus();
    try {
      const supabase = createBrowserSupabaseClient();
      const { data, error: creatorError } = await supabase
        .from("creators")
        .update({
          name: nextName,
          bio: nextBio,
          initials: initialsFrom(nextName),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .select("*")
        .single();
      if (creatorError) throw creatorError;

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ display_name: nextName })
        .eq("id", userId);
      if (profileError) throw profileError;

      const saved = mapCreator(data as CreatorRow);
      setName(saved.name);
      setBio(saved.bio);
      onSaved(saved);
      await refreshProfile();
      setMessage("Saved.");
    } catch (err) {
      setError(formatClientError(err, "Save failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="dashboard-verification-card" aria-label="Profile">
      <form className="account-profile-form" onSubmit={(event) => void onSubmit(event)}>
        <div className="large-avatar" style={{ background: creator.color }}>
          {initialsFrom(name)}
        </div>
        <label>
          Display name
          <input
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              clearStatus();
            }}
          />
        </label>
        <label>
          Bio
          <textarea
            rows={4}
            value={bio}
            onChange={(event) => {
              setBio(event.target.value);
              clearStatus();
            }}
          />
        </label>
        <div className="account-profile-storefront-hint">
          <p className="form-footnote">Shown on your public storefront.</p>
          <Link className="link-button" href={`/creators/${creator.slug}`}>
            View storefront
          </Link>
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        {message ? <p className="form-success">{message}</p> : null}
        <div className="dashboard-actions">
          <button type="submit" className="primary-button small" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </section>
  );
}
