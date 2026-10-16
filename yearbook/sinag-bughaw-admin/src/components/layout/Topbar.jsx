import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
import Icon from "../shared/Icon";

const TYPE_ICON = {
  registration: "users",
  upload: "gallery",
  subscription: "crown",
};

export default function Topbar() {
  const { admin, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const panelRef = useRef(null);
  const acknowledged = useRef(new Set());

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);

  const today = new Date().toLocaleDateString("en-PH", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const displayName = admin?.name ?? "Admin";
  const displayRole = isSuperAdmin ? "Super Admin" : "Admin";
  const photoUrl = admin?.profile_photo ?? admin?.profile_picture ?? admin?.avatar ?? admin?.photo ?? null;
  const initials = displayName.trim().slice(0, 1).toUpperCase() || "A";

  const applyItems = useCallback((nextItems) => {
    const merged = nextItems.map((item) => (
      acknowledged.current.has(item.id) ? { ...item, unread: false } : item
    ));
    setItems(merged);
    setUnread(merged.filter((item) => item.unread).length);
    return merged;
  }, []);

  const loadNotifications = useCallback(async () => {
    const res = await api.get("/admin/notifications");
    return applyItems(res.data.items ?? []);
  }, [applyItems]);

  const markRead = useCallback(async (ids) => {
    const keys = [...new Set(ids.filter(Boolean))];
    if (!keys.length) return;
    keys.forEach((id) => acknowledged.current.add(id));
    setItems((current) => current.map((item) => (
      keys.includes(item.id) ? { ...item, unread: false } : item
    )));
    setUnread((current) => Math.max(0, current - keys.length));
    try {
      const res = await api.post("/admin/notifications/read", { ids: keys });
      setUnread(Number(res.data.unread_count ?? 0));
    } catch (error) {
      keys.forEach((id) => acknowledged.current.delete(id));
      throw error;
    }
  }, []);

  useEffect(() => {
    loadNotifications().catch(() => {});
    const timer = window.setInterval(() => {
      loadNotifications().catch(() => {});
    }, 30000);
    const onAccounts = () => loadNotifications().catch(() => {});
    window.addEventListener("admin-users-changed", onAccounts);
    window.addEventListener("focus", onAccounts);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("admin-users-changed", onAccounts);
      window.removeEventListener("focus", onAccounts);
    };
  }, [loadNotifications]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    const onKey = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (!next) return;
    setLoading(true);
    try {
      const nextItems = await loadNotifications();
      const ids = nextItems.filter((item) => item.unread).map((item) => item.id);
      if (ids.length) await markRead(ids);
    } catch {
      /* Keep the last list if the refresh fails. */
    } finally {
      setLoading(false);
    }
  };

  const openItem = (item) => {
    if (item.unread) {
      markRead([item.id]).catch(() => {});
    }
    setOpen(false);
    if (item.href) navigate(item.href);
  };

  const badge = unread > 9 ? "9+" : String(unread);

  return (
    <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between gap-4 border-b border-slate-200/80 bg-white/90 px-6 backdrop-blur-md">
      <div className="inline-flex items-center gap-2 text-sm font-extrabold tracking-normal text-slate-500">
        <Icon name="calendar" className="h-4 w-4 text-indigo-500" />
        {today}
      </div>

      <div className="flex items-center gap-3">
        <div className="relative" ref={panelRef}>
          <button
            type="button"
            className="admin-icon-button relative"
            aria-label="Notifications"
            aria-expanded={open}
            aria-haspopup="menu"
            onClick={toggle}
          >
            <Icon name="bell" className="h-4 w-4" />
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 grid min-w-[18px] place-items-center rounded-full border-2 border-white bg-rose-500 px-1 text-[10px] font-black leading-4 text-white">
                {badge}
              </span>
            )}
          </button>

          {open && (
            <div
              role="menu"
              className="absolute right-0 top-12 z-40 w-[340px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
            >
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <span className="text-sm font-black text-slate-800">Notifications</span>
                <span className="text-[11px] font-bold text-slate-400">
                  {unread > 0 ? `${unread} unread` : "Up to date"}
                </span>
              </div>
              <div className="max-h-[380px] overflow-y-auto">
                {loading && items.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-slate-400">Loading…</div>
                ) : items.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-slate-400">No notifications yet.</div>
                ) : (
                  items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="menuitem"
                      onClick={() => openItem(item)}
                      className="flex w-full items-start gap-3 border-b border-slate-50 px-4 py-3 text-left transition hover:bg-slate-50"
                    >
                      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600">
                        <Icon name={TYPE_ICON[item.type] ?? "bell"} className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-bold text-slate-800">{item.title}</span>
                          {item.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-rose-500" />}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-slate-500">{item.body}</span>
                        <span className="mt-1 block text-[11px] font-semibold text-slate-400">{item.time}</span>
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 border-l border-slate-200 pl-4">
          <div className="hidden text-right sm:block">
            <div className="text-sm font-black leading-5 text-slate-900">{displayName}</div>
            <div className={`text-xs font-black uppercase tracking-wider ${isSuperAdmin ? "text-violet-600" : "text-slate-400"}`}>
              {displayRole}
            </div>
          </div>
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={displayName}
              className="h-10 w-10 rounded-xl border border-indigo-200 object-cover"
            />
          ) : (
            <div className={`grid h-10 w-10 place-items-center rounded-full border text-sm font-black ${isSuperAdmin ? "border-violet-200 bg-violet-100 text-violet-700" : "border-indigo-200 bg-indigo-100 text-indigo-700"}`}>
              {initials}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
