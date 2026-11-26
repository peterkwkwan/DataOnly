"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { useAuth } from "@/context/auth-context";
import { formatClientError } from "@/lib/errors";
import { createBrowserSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";

type NotificationRow = {
  id: string;
  title: string;
  body: string;
  href: string;
  read_at: string | null;
  created_at: string;
};

function shortAgo(iso: string): string {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (!Number.isFinite(seconds) || seconds < 45) return "Just now";
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h ago`;
  return `${Math.round(seconds / 86400)}d ago`;
}

function metaLine(row: NotificationRow): string {
  const when = shortAgo(row.created_at);
  const body = row.body.trim();
  return body ? `${body} · ${when}` : when;
}

export function NotificationsBell() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const listGen = useRef(0);
  const countGen = useRef(0);
  const panelId = useId();

  // shortcut: the badge does not move until a navigation, a focus return, or an open. Add a channel only if a sale must update the badge while the tab stays focused and still.
  useEffect(() => {
    if (!user || !isSupabaseConfigured()) return;

    let cancelled = false;

    async function refreshCount() {
      const req = ++countGen.current;
      try {
        const supabase = createBrowserSupabaseClient();
        const { count, error } = await supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .is("read_at", null);
        if (cancelled || req !== countGen.current || error) return;
        setUnread(count ?? 0);
      } catch {
        // Leave the badge as it was so the next focus or navigation retries.
      }
    }

    void refreshCount();
    const onFocus = () => {
      void refreshCount();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
    };
  }, [user, pathname]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (rootRef.current && target && !rootRef.current.contains(target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function loadList() {
    const gen = ++listGen.current;
    setListLoading(true);
    setListError(null);
    if (!isSupabaseConfigured()) {
      if (gen === listGen.current) {
        setRows([]);
        setListError("Supabase is not configured.");
        setListLoading(false);
      }
      return;
    }

    try {
      const supabase = createBrowserSupabaseClient();
      const { data, error } = await supabase
        .from("notifications")
        .select("id, title, body, href, read_at, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (gen !== listGen.current) return;
      if (error) {
        setRows([]);
        setListError(formatClientError(error, "Couldn't load notifications"));
        return;
      }

      setRows((data ?? []) as NotificationRow[]);
      const readAt = new Date().toISOString();
      const { error: readError } = await supabase
        .from("notifications")
        .update({ read_at: readAt })
        .is("read_at", null);
      if (gen !== listGen.current || readError) return;

      countGen.current += 1;
      setUnread(0);
      setRows((current) => current.map((row) => ({ ...row, read_at: row.read_at ?? readAt })));
    } catch (err) {
      if (gen !== listGen.current) return;
      setRows([]);
      setListError(formatClientError(err, "Couldn't load notifications"));
    } finally {
      if (gen === listGen.current) setListLoading(false);
    }
  }

  if (!user) return null;

  const label = unread > 0 ? `Notifications, ${unread} unread` : "Notifications";

  return (
    <div className="notifications-bell" ref={rootRef}>
      <button
        type="button"
        className="icon-button"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={panelId}
        aria-label={label}
        onClick={() => {
          if (open) {
            setOpen(false);
            return;
          }
          setOpen(true);
          void loadList();
        }}
      >
        <span className="notifications-bell-icon">
          <Icon name="bell" size={19} />
        </span>
        {unread > 0 ? (
          <span className="save-count" aria-hidden="true">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className="account-menu-panel notifications-panel"
          id={panelId}
          role="dialog"
          aria-label="Notifications"
        >
          <p className="notifications-panel-title">Notifications</p>
          {listError ? <p className="form-error">{listError}</p> : null}
          {!listError && !listLoading && rows.length === 0 ? (
            <p className="notifications-empty">No notifications yet.</p>
          ) : null}
          {rows.length > 0 ? (
            <div className="account-menu-items">
              {rows.map((row) => (
                <Link
                  key={row.id}
                  href={row.href}
                  className="account-menu-item notification-row"
                  onClick={() => setOpen(false)}
                >
                  {row.read_at == null ? (
                    <span className="notification-dot" aria-hidden="true" />
                  ) : null}
                  <span className="notification-copy">
                    <span>{row.title}</span>
                    <span className="notification-meta">{metaLine(row)}</span>
                  </span>
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
