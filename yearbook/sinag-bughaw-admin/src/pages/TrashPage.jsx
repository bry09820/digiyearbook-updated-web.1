import { useEffect, useState, useCallback, useRef } from "react";
import api, { notifyAdminAccountsChanged } from "../services/api";

// Design tokens (matches existing admin panel palette)
const T = {
  bg:         "#f0f4ff",
  surface:    "#ffffff",
  border:     "#e2e8f5",
  text:       "#1a2540",
  muted:      "#5b6784",
  primary:    "#4254c5",
  success:    "#16a34a",  successBg: "#dcfce7",
  danger:     "#ef4444",  dangerBg:  "#fee2e2",
  warning:    "#d97706",  warningBg: "#fef3c7",
  purple:     "#7c3aed",  purpleBg:  "#f4ebff",
  shadow:     "0 2px 12px rgba(66,84,197,.07)",
  shadowMd:   "0 4px 24px rgba(66,84,197,.13)",
};

const TYPE_ORDER = [
  "yearbook","faculty","graduation_album","album",
  "photo","post_media","tagged_photo",
  "batch","section","student",
];

const ICONS = {
  trash: <><path d="M4 7h16" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M6 7l1 14h10l1-14" /><path d="M9 7V4h6v3" /></>,
  restore: <><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v6h6" /></>,
  user: <><path d="M20 21a8 8 0 0 0-16 0" /><circle cx="12" cy="8" r="4" /></>,
  faculty: <><path d="M12 3 3 8l9 5 9-5-9-5Z" /><path d="M7 11v5c3 2 7 2 10 0v-5" /></>,
  student: <><path d="M12 3 3 7.5 12 12l9-4.5L12 3Z" /><path d="M7 10v3c3 2 7 2 10 0v-3" /><circle cx="12" cy="16" r="2.4" /><path d="M7.5 21a4.5 4.5 0 0 1 9 0" /></>,
};

function Icon({ name, className = "h-4 w-4", style }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
      {ICONS[name] ?? ICONS.trash}
    </svg>
  );
}

// Tiny helpers
const Sk = ({ w = "100%", h = 14, r = 6, style = {} }) => (
  <div style={{
    width: w, height: h, borderRadius: r,
    background: "linear-gradient(90deg,#e8edf8 25%,#f4f6fc 50%,#e8edf8 75%)",
    backgroundSize: "200% 100%",
    animation: "shimmer 1.4s infinite linear", ...style,
  }} />
);

function Badge({ label, color, bg }) {
  return (
    <span style={{
      display: "inline-flex", padding: "2px 9px", borderRadius: 999,
      fontSize: "0.7rem", fontWeight: 700, color, background: bg, whiteSpace: "nowrap",
    }}>{label}</span>
  );
}

function useToast() {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((message, type = "success") => {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3200);
  }, []);
  return { toasts, push };
}

function Toast({ toasts }) {
  return (
    <div style={{ position:"fixed", bottom:24, right:24, zIndex:9999, display:"flex", flexDirection:"column", gap:10 }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          padding:"11px 18px", borderRadius:12, fontWeight:600, fontSize:"0.87rem",
          background: t.type === "error" ? T.dangerBg : T.successBg,
          color:      t.type === "error" ? T.danger   : T.success,
          border:     `1px solid ${t.type === "error" ? "#fca5a5" : "#86efac"}`,
          boxShadow:  T.shadowMd, animation: "fadeIn .2s ease",
        }}>{t.message}</div>
      ))}
    </div>
  );
}

function ConfirmModal({ open, title, message, confirmLabel, confirmColor, onConfirm, onCancel, loading }) {
  if (!open) return null;
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(15,23,41,.55)", zIndex:1000, display:"grid", placeItems:"center" }}
      onClick={onCancel}>
      <div style={{ background:T.surface, borderRadius:20, padding:"28px 30px", width:420, boxShadow:T.shadowMd, animation:"fadeIn .18s ease" }}
        onClick={e => e.stopPropagation()}>
        <div style={{ fontSize:"1.1rem", fontWeight:800, color:T.text, marginBottom:10 }}>{title}</div>
        <div style={{ fontSize:"0.9rem", color:T.muted, marginBottom:24, lineHeight:1.6 }}>{message}</div>
        <div style={{ display:"flex", justifyContent:"flex-end", gap:10 }}>
          <button onClick={onCancel} disabled={loading}
            style={{ padding:"9px 20px", borderRadius:10, border:`1px solid ${T.border}`, background:"none", color:T.muted, fontWeight:600, cursor:"pointer", fontFamily:"inherit", fontSize:"0.88rem" }}>
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            style={{ padding:"9px 20px", borderRadius:10, border:"none", background:confirmColor ?? T.primary, color:"#fff", fontWeight:700, cursor:loading?"not-allowed":"pointer", opacity:loading?0.7:1, fontFamily:"inherit", fontSize:"0.88rem" }}>
            {loading ? "Processing…" : (confirmLabel ?? "Confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}

function Pagination({ meta, onPage }) {
  if (!meta || meta.last_page <= 1) return null;
  const { current_page: cur, last_page: last } = meta;
  const pages = [];
  for (let i = Math.max(1, cur - 2); i <= Math.min(last, cur + 2); i++) pages.push(i);
  const Btn = ({ label, page, disabled, active }) => (
    <button onClick={() => !disabled && onPage(page)}
      style={{ padding:"6px 12px", borderRadius:8, border:`1px solid ${active?T.primary:T.border}`, background:active?T.primary:T.surface, color:active?"#fff":T.text, fontWeight:600, fontSize:"0.82rem", cursor:disabled?"default":"pointer", opacity:disabled?0.4:1, fontFamily:"inherit" }}>
      {label}
    </button>
  );
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:16, flexWrap:"wrap", gap:8 }}>
      <div style={{ fontSize:"0.82rem", color:T.muted }}>Page {cur} of {last} · {meta.total} items</div>
      <div style={{ display:"flex", gap:5 }}>
        <Btn label="←" page={cur-1} disabled={cur===1} />
        {pages.map(p => <Btn key={p} label={p} page={p} active={p===cur} />)}
        <Btn label="→" page={cur+1} disabled={cur===last} />
      </div>
    </div>
  );
}

// Type sidebar tab
function TypeTab({ slug, label, count, active, onClick }) {
  const iconName = slug === "faculty" ? "faculty" : slug === "student" ? "student" : slug === "user" ? "user" : "trash";

  return (
    <button onClick={() => onClick(slug)}
      style={{
        display:"flex", alignItems:"center", justifyContent:"space-between",
        width:"100%", padding:"10px 14px", borderRadius:12,
        border:`1px solid ${active ? T.primary : "transparent"}`,
        background: active ? "#edf2ff" : "none",
        color: active ? T.primary : T.muted,
        fontWeight: active ? 700 : 500,
        fontSize:"0.86rem", cursor:"pointer", fontFamily:"inherit",
        transition:"all .15s",
      }}>
      <span style={{ display:"flex", alignItems:"center", gap:8 }}>
        <Icon name={iconName} className="h-4 w-4" />
        <span>{label}</span>
      </span>
      {count > 0 && (
        <span style={{ background:active?T.primary:"#e2e8f5", color:active?"#fff":T.muted, borderRadius:999, padding:"1px 7px", fontSize:"0.72rem", fontWeight:700 }}>
          {count}
        </span>
      )}
    </button>
  );
}

// Single trash item card
function TrashCard({ item, selected, onSelect, onRestore, onForce, busy }) {
  const isBusy = busy === `${item.type}-${item.id}`;
  const mediaType = String(item.media_type || "").toLowerCase();
  const canRenderImage = item.thumbnail && (!mediaType || mediaType === "image" || mediaType === "record");
  const canRenderVideo = item.thumbnail && mediaType === "video";
  const previewIcon = item.type === "faculty"
    ? "faculty"
    : item.type === "student"
    ? "student"
    : item.type === "user"
    ? "user"
    : "trash";
  const previewLabel = mediaType === "video"
    ? "Video"
    : mediaType === "audio"
    ? "Audio"
    : item.label;

  return (
    <div style={{
      background: T.surface,
      border: `1.5px solid ${selected ? T.primary : T.border}`,
      borderRadius: 16,
      overflow: "hidden",
      boxShadow: selected ? `0 0 0 3px rgba(66,84,197,.13)` : T.shadow,
      display: "flex",
      flexDirection: "column",
      transition: "border-color .15s, box-shadow .15s",
      opacity: isBusy ? 0.7 : 1,
    }}>
      {/* Thumbnail */}
      <div style={{ height: 100, background:"linear-gradient(135deg,#1a2540,#4254c5)", position:"relative", flexShrink:0 }}>
        {canRenderImage && (
          <img
            src={item.thumbnail}
            alt={item.title}
            style={{ width:"100%", height:"100%", objectFit:"cover" }}
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
        )}
        {canRenderVideo && (
          <video
            src={item.thumbnail}
            muted
            preload="metadata"
            style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }}
          />
        )}
        {!canRenderImage && !canRenderVideo && (
          <div style={{ height:"100%", display:"flex", flexDirection:"column", gap:6, alignItems:"center", justifyContent:"center", color:"rgba(255,255,255,.72)" }}>
            <Icon name={previewIcon} className="h-9 w-9" />
            <span style={{ fontSize:"0.7rem", fontWeight:800, letterSpacing:".08em", textTransform:"uppercase" }}>{previewLabel}</span>
          </div>
        )}
        {/* Checkbox */}
        <div style={{ position:"absolute", top:8, left:8 }}
          onClick={e => { e.stopPropagation(); onSelect(item); }}>
          <div style={{
            width:20, height:20, borderRadius:6,
            background: selected ? T.primary : "rgba(255,255,255,.85)",
            border: `2px solid ${selected ? T.primary : "rgba(255,255,255,.5)"}`,
            display:"grid", placeItems:"center", cursor:"pointer",
            transition:"all .12s",
          }}>
            {selected && <span style={{ color:"#fff", fontSize:"0.7rem", lineHeight:1 }}>✓</span>}
          </div>
        </div>
        {/* Type badge */}
        <div style={{ position:"absolute", top:8, right:8 }}>
          <Badge label={item.label} color="#fff" bg="rgba(15,23,41,.55)" />
        </div>
      </div>

      {/* Info */}
      <div style={{ padding:"12px 14px", flex:1 }}>
        <div style={{ fontWeight:700, fontSize:"0.9rem", color:T.text, marginBottom:3,
          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
          {item.title}
        </div>
        {item.subtitle && (
          <div style={{ fontSize:"0.76rem", color:T.muted, marginBottom:6 }}>{item.subtitle}</div>
        )}
        <div style={{ fontSize:0, color:T.warning, fontWeight:500 }}>
          <span style={{ display:"inline-flex", alignItems:"center", gap:5, fontSize:"0.74rem" }}>
            <Icon name="trash" className="h-3.5 w-3.5" /> Deleted {item.deleted_ago}
          </span>
          🗑 Deleted {item.deleted_ago}
        </div>
      </div>

      {/* Actions */}
      <div style={{ padding:"10px 14px", borderTop:`1px solid ${T.border}`, display:"flex", gap:7 }}>
        <button onClick={() => onRestore(item)} disabled={isBusy}
          style={{ flex:1, padding:"7px", borderRadius:9, border:"none", background:T.successBg, color:T.success, fontWeight:700, fontSize:0, cursor:"pointer", fontFamily:"inherit", opacity:isBusy?0.6:1, display:"inline-flex", alignItems:"center", justifyContent:"center", gap:6 }}>
          <span style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:"0.78rem" }}><Icon name="restore" className="h-4 w-4" /> Restore</span>
          ↩ Restore
        </button>
        <button onClick={() => onForce(item)} disabled={isBusy}
          style={{ padding:"7px 10px", borderRadius:9, border:"none", background:T.dangerBg, color:T.danger, fontWeight:700, fontSize:0, cursor:"pointer", fontFamily:"inherit", opacity:isBusy?0.6:1, display:"inline-flex", alignItems:"center", justifyContent:"center" }}>
          <Icon name="trash" className="h-4 w-4" />
          🗑
        </button>
      </div>
    </div>
  );
}

// Empty state
function EmptyBin({ filtered }) {
  return (
    <div className="trash-empty-state" style={{ textAlign:"center", padding:"64px 20px", color:T.muted }}>
      <div className="trash-empty-icon" style={{ display:"inline-flex", width:64, height:64, alignItems:"center", justifyContent:"center", borderRadius:18, background:T.dangerBg, color:T.danger, marginBottom:16 }}>
        <Icon name="trash" className="h-8 w-8" />
      </div>
      <div style={{ fontSize:"3.5rem", marginBottom:16 }}>🗑️</div>
      <div style={{ fontWeight:800, fontSize:"1.1rem", color:T.text, marginBottom:8 }}>
        {filtered ? "No matching items in trash" : "Trash is empty"}
      </div>
      <div style={{ fontSize:"0.88rem" }}>
        {filtered ? "Try a different search or type filter." : "Deleted items from all modules appear here."}
      </div>
    </div>
  );
}

// Main Page
const inputStyle = {
  padding:"9px 14px", borderRadius:10, border:`1px solid ${T.border}`,
  fontSize:"0.88rem", color:T.text, background:T.surface,
  fontFamily:"inherit", outline:"none",
};

export default function TrashPage() {
  const [counts,       setCounts]      = useState({});
  const [activeType,   setActiveType]  = useState("all");
  const [items,        setItems]       = useState([]);
  const [meta,         setMeta]        = useState(null);
  const [loading,      setLoading]     = useState(true);
  const [page,         setPage]        = useState(1);
  const [search,       setSearch]      = useState("");
  const [selected,     setSelected]    = useState(new Set());
  const [busy,         setBusy]        = useState(null);
  const [confirm,      setConfirm]     = useState(null); 
  const { toasts, push: toast }        = useToast();
  const searchTimer                    = useRef(null);

  // Fetch counts
  const fetchCounts = useCallback(async () => {
    try {
      const res = await api.get("/admin/trash/counts");
      setCounts(res.data);
    } catch { /* silent */ }
  }, []);

  // Fetch items
  const fetchItems = useCallback(async (p = 1, q = search, type = activeType) => {
    setLoading(true);
    setSelected(new Set());
    try {
      const params = { page: p, per_page: 15, search: q };
      if (type !== "all") params.type = type;

      const res = await api.get("/admin/trash", { params });

      // When a specific type is selected the API returns a single typed object
      // When "all" is selected it returns { [type]: {...} } keyed by type
      if (type !== "all") {
        setItems(res.data.data ?? []);
        setMeta({
          total:        res.data.total,
          current_page: res.data.current_page,
          last_page:    res.data.last_page,
          per_page:     res.data.per_page,
        });
      } else {
        // Merge all type groups into a flat list (max 15 per type, first page)
        const flat = [];
        Object.values(res.data).forEach(group => {
          if (group && Array.isArray(group.data)) flat.push(...group.data);
        });
        setItems(flat);
        setMeta(null); // no single pagination for "all" view
      }
    } catch {
      toast("Failed to load trash.", "error");
    } finally {
      setLoading(false);
    }
  }, [search, activeType]);

  useEffect(() => {
    fetchCounts();
  }, []);

  useEffect(() => {
    fetchItems(page);
  }, [page, activeType]);

  // Search debounce
  const handleSearch = v => {
    setSearch(v);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(1);
      fetchItems(1, v, activeType);
    }, 380);
  };

  // Type tab switch
  const handleTypeChange = type => {
    setActiveType(type);
    setPage(1);
    setSelected(new Set());
  };

  // Selection helpers
  const toggleSelect = item => {
    setSelected(prev => {
      const next = new Set(prev);
      const key  = `${item.type}:${item.id}`;
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map(i => `${i.type}:${i.id}`)));
    }
  };

  // Convert selected Set into { type: [ids] } map
  const groupSelected = () => {
    const map = {};
    selected.forEach(key => {
      const [type, id] = key.split(":");
      if (!map[type]) map[type] = [];
      map[type].push(parseInt(id));
    });
    return map;
  };

  // Single restore
  const doRestore = async (item) => {
    setBusy(`${item.type}-${item.id}`);
    try {
      await api.post(`/admin/trash/${item.type}/${item.id}/restore`);
      if (item.type === "user" || item.type === "faculty" || item.type === "student") notifyAdminAccountsChanged();
      toast(`"${item.title}" restored successfully.`);
      fetchCounts();
      fetchItems(page);
    } catch {
      toast("Restore failed.", "error");
    } finally {
      setBusy(null);
    }
  };

  // Single force delete
  const doForce = async () => {
    if (!confirm?.item) return;
    const { item } = confirm;
    setBusy(`${item.type}-${item.id}`);
    try {
      await api.delete(`/admin/trash/${item.type}/${item.id}`);
      if (item.type === "user" || item.type === "faculty" || item.type === "student") notifyAdminAccountsChanged();
      toast(`"${item.title}" permanently deleted.`);
      setConfirm(null);
      fetchCounts();
      fetchItems(page);
    } catch {
      toast("Delete failed.", "error");
    } finally {
      setBusy(null);
    }
  };

  // Bulk restore
  const doBulkRestore = async () => {
    const groups = groupSelected();
    setConfirm(null);
    let total = 0;
    try {
      for (const [type, ids] of Object.entries(groups)) {
        const res = await api.post("/admin/trash/bulk-restore", { type, ids });
        total += res.data.restored ?? ids.length;
      }
      if (groups.user || groups.faculty || groups.student) notifyAdminAccountsChanged();
      toast(`${total} items restored.`);
      fetchCounts();
      fetchItems(page);
    } catch {
      toast("Bulk restore failed.", "error");
    }
  };

  // Bulk force delete
  const doBulkForce = async () => {
    const groups = groupSelected();
    setConfirm(null);
    let total = 0;
    try {
      for (const [type, ids] of Object.entries(groups)) {
        const res = await api.delete("/admin/trash/bulk-force", { data: { type, ids } });
        total += res.data.deleted ?? ids.length;
      }
      if (groups.user || groups.faculty || groups.student) notifyAdminAccountsChanged();
      toast(`${total} items permanently deleted.`);
      fetchCounts();
      fetchItems(page);
    } catch {
      toast("Bulk delete failed.", "error");
    }
  };

  // Sidebar counts
  const totalCount = counts._total ?? 0;

  const sidebarTypes = [
    { slug: "all", icon: "🗑️", label: "All Trash", count: totalCount },
    ...TYPE_ORDER.map(slug => ({
      slug,
      icon:  counts[slug]?.icon  ?? "📄",
      label: counts[slug]?.label ?? slug,
      count: counts[slug]?.count ?? 0,
    })).filter(t => t.count > 0 || activeType === t.slug),
  ];

  const hasSelection = selected.size > 0;

  return (
    <>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes fadeIn  { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        .trash-empty-icon + div { display: none; }
        * { box-sizing: border-box; }
      `}</style>

      <div style={{ padding:"28px 24px 48px", background:T.bg, minHeight:"100vh", animation:"fadeIn .3s ease" }}>

        {/* Header */}
        <div style={{ marginBottom:24 }}>
          <h1 style={{ fontSize:"1.55rem", fontWeight:900, color:T.text, margin:0 }}>Trash</h1>
          <p style={{ color:T.muted, fontSize:"0.9rem", margin:"6px 0 0" }}>
            Restore accidentally deleted records or permanently remove them.
          </p>
        </div>

        <div style={{ display:"flex", gap:20, alignItems:"flex-start" }}>

          {/* Sidebar */}
          <div style={{
            width: 220, flexShrink:0,
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: 18,
            padding: "14px 10px",
            boxShadow: T.shadow,
            position: "sticky",
            top: 24,
          }}>
            <div style={{ fontSize:"0.72rem", fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:".08em", padding:"4px 6px 10px" }}>
              Filter by Type
            </div>
            {sidebarTypes.map(t => (
              <TypeTab key={t.slug} {...t} active={activeType === t.slug} onClick={handleTypeChange} />
            ))}
          </div>

          {/* Main content */}
          <div style={{ flex:1, minWidth:0 }}>

            {/* Search + Bulk actions bar */}
            <div style={{ display:"flex", gap:10, marginBottom:18, flexWrap:"wrap", alignItems:"center" }}>
              <input
                value={search}
                onChange={e => handleSearch(e.target.value)}
                placeholder="🔍 Search deleted items…"
                style={{ ...inputStyle, flex:1, minWidth:200 }}
              />

              {/* Select all toggle */}
              <button onClick={selectAll}
                style={{ ...inputStyle, cursor:"pointer", whiteSpace:"nowrap",
                  background: hasSelection ? "#edf2ff" : T.surface,
                  color: hasSelection ? T.primary : T.muted,
                  border: `1px solid ${hasSelection ? T.primary : T.border}`,
                  fontWeight: 600,
                }}>
                {selected.size === items.length && items.length > 0 ? "Deselect All" : "Select All"}
              </button>

              {/* Bulk restore */}
              {hasSelection && (
                <button
                  onClick={() => setConfirm({ mode: "bulk-restore" })}
                  style={{ padding:"9px 16px", borderRadius:10, border:"none", background:T.successBg, color:T.success, fontWeight:700, fontSize:0, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>
                  <span style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:"0.87rem" }}><Icon name="restore" className="h-4 w-4" /> Restore {selected.size}</span>
                  ↩ Restore {selected.size}
                </button>
              )}

              {/* Bulk force delete */}
              {hasSelection && (
                <button
                  onClick={() => setConfirm({ mode: "bulk-force" })}
                  style={{ padding:"9px 16px", borderRadius:10, border:"none", background:T.dangerBg, color:T.danger, fontWeight:700, fontSize:0, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>
                  <span style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:"0.87rem" }}><Icon name="trash" className="h-4 w-4" /> Delete {selected.size}</span>
                  🗑 Delete {selected.size}
                </button>
              )}
            </div>

            {/* Grid */}
            {loading ? (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))", gap:16 }}>
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} style={{ background:T.surface, borderRadius:16, overflow:"hidden", border:`1px solid ${T.border}` }}>
                    <Sk w="100%" h={100} r={0} />
                    <div style={{ padding:14 }}>
                      <Sk w="70%" h={14} style={{ marginBottom:8 }} />
                      <Sk w="50%" h={11} />
                    </div>
                  </div>
                ))}
              </div>
            ) : items.length === 0 ? (
              <EmptyBin filtered={!!search || activeType !== "all"} />
            ) : (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))", gap:16 }}>
                {items.map(item => (
                  <TrashCard
                    key={`${item.type}-${item.id}`}
                    item={item}
                    selected={selected.has(`${item.type}:${item.id}`)}
                    onSelect={toggleSelect}
                    onRestore={doRestore}
                    onForce={item => setConfirm({ mode: "force", item })}
                    busy={busy}
                  />
                ))}
              </div>
            )}

            {/* Pagination (only for single-type view) */}
            {activeType !== "all" && (
              <Pagination meta={meta} onPage={p => setPage(p)} />
            )}

          </div>
        </div>
      </div>

      {/* Confirm modals */}
      <ConfirmModal
        open={confirm?.mode === "force"}
        title="Permanently Delete"
        message={`This will permanently delete "${confirm?.item?.title}" and cannot be undone. Any associated Cloudinary assets will also be removed.`}
        confirmLabel="Delete Forever"
        confirmColor={T.danger}
        onConfirm={doForce}
        onCancel={() => setConfirm(null)}
        loading={busy === `${confirm?.item?.type}-${confirm?.item?.id}`}
      />

      <ConfirmModal
        open={confirm?.mode === "bulk-restore"}
        title={`Restore ${selected.size} Items`}
        message={`Restore all ${selected.size} selected items back to their original module? They will return as they were before deletion.`}
        confirmLabel={`Restore ${selected.size}`}
        confirmColor={T.success}
        onConfirm={doBulkRestore}
        onCancel={() => setConfirm(null)}
        loading={false}
      />

      <ConfirmModal
        open={confirm?.mode === "bulk-force"}
        title={`Permanently Delete ${selected.size} Items`}
        message={`This will permanently destroy all ${selected.size} selected items, including any Cloudinary assets. This cannot be undone.`}
        confirmLabel={`Delete ${selected.size} Forever`}
        confirmColor={T.danger}
        onConfirm={doBulkForce}
        onCancel={() => setConfirm(null)}
        loading={false}
      />

      <Toast toasts={toasts} />
    </>
  );
}
