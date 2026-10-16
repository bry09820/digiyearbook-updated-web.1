/**
 * MediaModerationPage.jsx
 * NU Lipa / Sinag-Bughaw — Admin Panel
 *
 * Single unified page with two modes:
 * Moderation Photos (album-grouped) | Videos | Reported
 * Media Library Albums (CRUD) | Photos (browse) | Videos
 *
 * Features:
 *   Approve / Reject with reason modal
 *   Bulk approve / reject
 *   Album drill-down panel with lightbox
 *   Generic preview modal (video / voice)
 * Revert Status flip any approved/rejected item back to pending or opposite
 * Status History full audit trail in a slide-out drawer
 * Media Library Albums CRUD, Photos browse/delete, Videos
 * Media Library album drill-down open any album and see all its photos
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import api from "../services/api";

// Design Tokens
const T = {
  bg:        "#f0f4ff",
  surface:   "#ffffff",
  border:    "#e2e8f5",
  text:      "#1a2540",
  muted:     "#5b6784",
  primary:   "#4254c5",
  success:   "#16a34a",
  successBg: "#dcfce7",
  danger:    "#ef4444",
  dangerBg:  "#fee2e2",
  warning:   "#d97706",
  warningBg: "#fef3c7",
  info:      "#0891b2",
  infoBg:    "#e0f2fe",
  purple:    "#7c3aed",
  purpleBg:  "#f4ebff",
  shadow:    "0 2px 12px rgba(66,84,197,.07)",
  shadowMd:  "0 4px 24px rgba(66,84,197,.13)",
  shadowLg:  "0 8px 40px rgba(15,23,41,.22)",
};


// SHARED PRIMITIVES


const Skeleton = ({ w = "100%", h = 14, radius = 6, style = {} }) => (
  <div style={{
    width: w, height: h, borderRadius: radius,
    background: "linear-gradient(90deg,#e8edf8 25%,#f4f6fc 50%,#e8edf8 75%)",
    backgroundSize: "200% 100%",
    animation: "shimmer 1.4s infinite linear",
    ...style,
  }} />
);

const ICONS = {
  albums: <><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5z" /><path d="m8 14 2.2-2.2a1 1 0 0 1 1.4 0L14 14.2l1-1a1 1 0 0 1 1.4 0L20 16.8" /><path d="M8.5 8.5h.01" /></>,
  photos: <><path d="M4 7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z" /><path d="m8 15 2.5-2.5a1 1 0 0 1 1.4 0L14 14.6l1.2-1.2a1 1 0 0 1 1.4 0L20 16.8" /><path d="M8.5 8.5h.01" /></>,
  videos: <><path d="M5 5h11a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H5z" /><path d="m10 9 5 3-5 3z" /></>,
  voice: <><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z" /><path d="M19 11a7 7 0 0 1-14 0" /><path d="M12 18v3" /></>,
  moderation: <><path d="M12 3 5 6v5c0 5 3.5 8 7 10 3.5-2 7-5 7-10V6z" /><path d="m9 12 2 2 4-5" /></>,
  library: <><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" /><path d="M8 6v12" /></>,
  trash: <><path d="M4 7h16" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M6 7l1 14h10l1-14" /><path d="M9 7V4h6v3" /></>,
  restore: <><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v6h6" /></>,
};

function Icon({ name, className = "h-5 w-5", style }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
      {ICONS[name] ?? ICONS.photos}
    </svg>
  );
}

function Badge({ label, color, bg }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "3px 10px", borderRadius: 999,
      fontSize: "0.72rem", fontWeight: 700,
      color, background: bg, whiteSpace: "nowrap",
    }}>
      {label}
    </span>
  );
}

function visibilityLabel(value) {
  const key = String(value || "public").toLowerCase();
  return key === "friends" ? "batchmates" : key;
}

function mediaKind(item = {}) {
  const type = String(item.resource_type ?? item.file_type ?? item.type ?? "").toLowerCase();
  const url = String(item.url ?? item.file_path ?? item.video_url ?? "");

  if (type.includes("video") || /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url)) return "video";
  return "image";
}

function MediaPreview({ item, src, alt = "", fit = "cover" }) {
  const kind = mediaKind(item);

  if (!src) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#ffffff55", fontSize: "2rem" }}>
        {kind === "video" ? "🎬" : "🖼"}
      </div>
    );
  }

  if (kind === "video") {
    return (
      <video
        src={src}
        muted
        playsInline
        preload="metadata"
        style={{ width: "100%", height: "100%", objectFit: fit, display: "block", background: "#000" }}
      />
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      style={{ width: "100%", height: "100%", objectFit: fit, display: "block" }}
      onError={e => { e.currentTarget.style.display = "none"; }}
    />
  );
}

function statusBadge(status) {
  const map = {
    pending:  { label: "Pending",  color: T.warning, bg: T.warningBg },
    approved: { label: "Approved", color: T.success, bg: T.successBg },
    rejected: { label: "Rejected", color: T.danger,  bg: T.dangerBg  },
    flagged:  { label: "Flagged",  color: T.purple,  bg: T.purpleBg  },
  };
  const s = map[status] ?? { label: status ?? "pending", color: T.muted, bg: T.border };
  return <Badge {...s} />;
}

function Empty({ icon, title, subtitle }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 20px", color: T.muted }}>
      <div style={{ fontSize: "3rem", marginBottom: 14 }}>{icon}</div>
      <div style={{ fontWeight: 700, fontSize: "1.05rem", color: T.text, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: "0.88rem" }}>{subtitle}</div>
    </div>
  );
}

function FilterPills({ options, value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {options.map(opt => (
        <button key={opt.value} onClick={() => onChange(opt.value)}
          style={{
            padding: "6px 14px", borderRadius: 20,
            border: `1px solid ${value === opt.value ? T.primary : T.border}`,
            background: value === opt.value ? "#edf2ff" : "none",
            color: value === opt.value ? T.primary : T.muted,
            fontWeight: 700, fontSize: "0.82rem", cursor: "pointer", fontFamily: "inherit",
          }}>
          {opt.label}
        </button>
      ))}
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
      style={{
        padding: "7px 13px", borderRadius: 9,
        border: `1px solid ${active ? T.primary : T.border}`,
        background: active ? T.primary : T.surface,
        color: active ? "#fff" : T.text,
        fontWeight: 600, fontSize: "0.84rem",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.4 : 1, fontFamily: "inherit",
      }}>
      {label}
    </button>
  );

  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 22, flexWrap: "wrap", gap: 10 }}>
      <div style={{ fontSize: "0.84rem", color: T.muted }}>Page {cur} of {last} · {meta.total} items</div>
      <div style={{ display: "flex", gap: 6 }}>
        <Btn label="←" page={cur - 1} disabled={cur === 1} />
        {pages.map(p => <Btn key={p} label={p} page={p} active={p === cur} />)}
        <Btn label="→" page={cur + 1} disabled={cur === last} />
      </div>
    </div>
  );
}

// Toast
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
  const colorMap = {
    error:   { bg: T.dangerBg,  color: T.danger,  border: "#fca5a5" },
    info:    { bg: T.infoBg,    color: T.info,     border: "#67e8f9" },
    success: { bg: T.successBg, color: T.success,  border: "#86efac" },
  };
  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999, display: "flex", flexDirection: "column", gap: 10 }}>
      {toasts.map(t => {
        const c = colorMap[t.type] ?? colorMap.success;
        return (
          <div key={t.id} style={{
            padding: "12px 18px", borderRadius: 12,
            fontWeight: 600, fontSize: "0.88rem",
            background: c.bg, color: c.color,
            border: `1px solid ${c.border}`,
            boxShadow: T.shadowMd, animation: "fadeIn .2s ease",
          }}>
            {t.message}
          </div>
        );
      })}
    </div>
  );
}

// Confirm Modal
function ConfirmModal({ open, title, message, onConfirm, onCancel, loading }) {
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,41,.55)", zIndex: 1800, display: "grid", placeItems: "center", padding: 20 }} onClick={onCancel}>
      <div style={{ background: T.surface, borderRadius: 20, padding: "26px 28px", width: "100%", maxWidth: 400, boxShadow: T.shadowMd, animation: "fadeIn .18s ease" }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: "1.05rem", fontWeight: 800, color: T.text, marginBottom: 6 }}>{title}</div>
        <div style={{ fontSize: "0.86rem", color: T.muted, marginBottom: 22 }}>{message}</div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={onCancel} disabled={loading}
            style={{ padding: "9px 20px", borderRadius: 10, border: `1px solid ${T.border}`, background: "none", color: T.muted, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", fontSize: "0.88rem" }}>
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            style={{ padding: "9px 20px", borderRadius: 10, border: "none", background: T.danger, color: "#fff", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1, fontFamily: "inherit", fontSize: "0.88rem" }}>
            {loading ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

function OverflowMenu({ actions = [], align = "right" }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const ref = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    const handler = e => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const toggleMenu = () => {
    if (open) {
      setOpen(false);
      return;
    }

    const rect = buttonRef.current?.getBoundingClientRect();
    const menuWidth = 170;
    const margin = 8;
    const left = align === "right"
      ? Math.max(margin, Math.min(window.innerWidth - menuWidth - margin, (rect?.right ?? 0) - menuWidth))
      : Math.max(margin, Math.min(window.innerWidth - menuWidth - margin, rect?.left ?? margin));

    setPos({ top: (rect?.bottom ?? 0) + 6, left });
    setOpen(true);
  };

  const menu = open ? createPortal(
    <div
      ref={ref}
      style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 2600, minWidth: 170, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, boxShadow: T.shadowMd, padding: 6 }}
      onClick={e => e.stopPropagation()}
    >
      {actions.map(action => (
        <button
          key={action.label}
          type="button"
          onClick={() => { setOpen(false); action.onClick?.(); }}
          disabled={action.disabled}
          onMouseEnter={e => { e.currentTarget.style.background = "#f8fafc"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
          style={{ width: "100%", border: "none", background: "transparent", color: action.destructive ? T.danger : T.text, textAlign: "left", padding: "9px 10px", borderRadius: 8, fontSize: "0.82rem", fontWeight: 700, cursor: action.disabled ? "not-allowed" : "pointer", opacity: action.disabled ? 0.55 : 1, fontFamily: "inherit" }}
        >
          {action.label}
        </button>
      ))}
    </div>,
    document.body
  ) : null;

  return (
    <div style={{ position: "relative", display: "inline-flex" }} onClick={e => e.stopPropagation()}>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleMenu}
        aria-label="More actions"
        style={{ width: 32, height: 32, borderRadius: 9, border: `1px solid ${T.border}`, background: T.surface, color: T.muted, cursor: "pointer", fontWeight: 900, fontSize: "1.1rem", lineHeight: 1 }}
      >
        ...
      </button>
      {menu}
    </div>
  );
}

function ModerationDecisionButtons({ onReject, onApprove, disabled }) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      <button
        type="button"
        onClick={onReject}
        disabled={disabled}
        style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${T.danger}`, background: "transparent", color: T.danger, fontSize: "0.75rem", fontWeight: 800, cursor: disabled ? "not-allowed" : "pointer", fontFamily: "inherit" }}
      >
        Reject
      </button>
      <button
        type="button"
        onClick={onApprove}
        disabled={disabled}
        style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: T.success, color: "#fff", fontSize: "0.75rem", fontWeight: 800, cursor: disabled ? "not-allowed" : "pointer", fontFamily: "inherit" }}
      >
        Approve
      </button>
    </div>
  );
}

// Reject Modal
function ApproveConfirmModal({ open, target, onConfirm, onCancel, loading }) {
  if (!open) return null;
  const label = target?.label || "this content";
  const isBulk = target?.kind === "bulk";
  const title = isBulk ? "Approve selected content?" : "Approve this content?";
  const message = isBulk
    ? `This will publish ${target?.count ?? 0} selected item${target?.count === 1 ? "" : "s"} and make them visible where allowed.`
    : `This will approve "${label}" and make it visible where allowed.`;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,41,.55)", zIndex: 2100, display: "grid", placeItems: "center", padding: 20 }} onClick={onCancel}>
      <div style={{ background: T.surface, borderRadius: 20, padding: "26px 28px", width: "100%", maxWidth: 420, boxShadow: T.shadowMd, animation: "fadeIn .18s ease" }} onClick={e => e.stopPropagation()}>
        <div style={{ width: 44, height: 44, borderRadius: 14, background: T.successBg, color: T.success, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: "1.2rem", marginBottom: 14 }}>
          ✓
        </div>
        <div style={{ fontSize: "1.05rem", fontWeight: 800, color: T.text, marginBottom: 6 }}>{title}</div>
        <div style={{ fontSize: "0.86rem", color: T.muted, lineHeight: 1.55, marginBottom: 22 }}>{message}</div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={onCancel} disabled={loading}
            style={{ padding: "9px 20px", borderRadius: 10, border: `1px solid ${T.border}`, background: "none", color: T.muted, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", fontSize: "0.88rem" }}>
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            style={{ padding: "9px 20px", borderRadius: 10, border: "none", background: T.success, color: "#fff", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1, fontFamily: "inherit", fontSize: "0.88rem" }}>
            {loading ? "Approving..." : "Yes, approve"}
          </button>
        </div>
      </div>
    </div>
  );
}

const REJECT_REASONS = [
  "Inappropriate content",
  "Copyright violation",
  "Low quality / blurry",
  "Wrong category",
  "Spam or duplicate",
  "Other",
];

function RejectModal({ open, onConfirm, onCancel, loading, title = "Reject Content" }) {
  const [reason, setReason] = useState("");
  useEffect(() => { if (!open) setReason(""); }, [open]);
  if (!open) return null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,41,.6)", zIndex: 2000, display: "grid", placeItems: "center", padding: 20 }} onClick={onCancel}>
      <div style={{ background: T.surface, borderRadius: 20, padding: "26px 28px", width: "100%", maxWidth: 440, boxShadow: T.shadowLg, animation: "fadeIn .18s ease" }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: "1.05rem", fontWeight: 800, color: T.text, marginBottom: 6 }}>{title}</div>
        <div style={{ fontSize: "0.86rem", color: T.muted, marginBottom: 18 }}>Select a reason for rejection, or leave it blank.</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
          {REJECT_REASONS.map(r => (
            <label key={r} style={{
              display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
              padding: "9px 12px", borderRadius: 10,
              border: `1px solid ${reason === r ? T.primary : T.border}`,
              background: reason === r ? "#edf2ff" : T.surface,
              transition: "all .12s",
            }}>
              <input type="radio" name="rej-reason" value={r} checked={reason === r} onChange={() => setReason(r)} style={{ accentColor: T.primary }} />
              <span style={{ fontSize: "0.86rem", fontWeight: 600, color: T.text }}>{r}</span>
            </label>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={onCancel} disabled={loading}
            style={{ padding: "9px 20px", borderRadius: 10, border: `1px solid ${T.border}`, background: "none", color: T.muted, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", fontSize: "0.88rem" }}>
            Cancel
          </button>
          <button onClick={() => onConfirm(reason)} disabled={loading}
            style={{ padding: "9px 20px", borderRadius: 10, border: "none", background: T.danger, color: "#fff", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1, fontFamily: "inherit", fontSize: "0.88rem" }}>
            {loading ? "Rejecting…" : "Reject"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Revert Status Modal
function RevertModal({ open, item, itemType, onConfirm, onCancel, loading }) {
  const [targetStatus, setTargetStatus] = useState("pending");
  const [note, setNote]                 = useState("");

  useEffect(() => {
    if (!open) { setNote(""); setTargetStatus("pending"); }
  }, [open]);

  if (!open || !item) return null;

  const currentStatus = item.status ?? "pending";
  const isApproved    = currentStatus === "approved";
  const isRejected    = currentStatus === "rejected";

  const targets = [];
  if (!isApproved) targets.push({ value: "approved", label: "✓ Approved", color: T.success, bg: T.successBg });
  if (!isRejected) targets.push({ value: "rejected", label: "✕ Rejected", color: T.danger,  bg: T.dangerBg  });
  targets.push(    { value: "pending",  label: "↺ Pending",  color: T.warning, bg: T.warningBg });

  const inputStyle = {
    width: "100%", padding: "9px 12px", borderRadius: 10,
    border: `1px solid ${T.border}`, fontSize: "0.88rem",
    color: T.text, fontFamily: "inherit", outline: "none",
    resize: "vertical", boxSizing: "border-box",
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,41,.65)", zIndex: 2100, display: "grid", placeItems: "center", padding: 20 }} onClick={onCancel}>
      <div style={{ background: T.surface, borderRadius: 22, padding: "28px 30px", width: "100%", maxWidth: 460, boxShadow: T.shadowLg, animation: "fadeIn .18s ease" }} onClick={e => e.stopPropagation()}>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: T.infoBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem" }}>↩</div>
          <div>
            <div style={{ fontSize: "1.05rem", fontWeight: 800, color: T.text }}>Revert Status</div>
            <div style={{ fontSize: "0.78rem", color: T.muted, marginTop: 1, display: "flex", alignItems: "center", gap: 6 }}>
              Currently: {statusBadge(currentStatus)}
            </div>
          </div>
        </div>

        <div style={{ background: T.bg, borderRadius: 12, padding: "10px 14px", marginBottom: 18, marginTop: 14 }}>
          <div style={{ fontSize: "0.82rem", fontWeight: 700, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {item.title ?? item.filename ?? item.caption ?? `${itemType} #${item.id}`}
          </div>
          <div style={{ fontSize: "0.75rem", color: T.muted, marginTop: 2 }}>
            {item.uploader ?? item.user_name ?? "Unknown"} · {item.created_at_human ?? ""}
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: "0.78rem", fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8 }}>Change status to</div>
          <div style={{ display: "flex", gap: 8 }}>
            {targets.map(t => (
              <button key={t.value} onClick={() => setTargetStatus(t.value)}
                style={{
                  flex: 1, padding: "10px 8px", borderRadius: 12,
                  border: `2px solid ${targetStatus === t.value ? t.color : T.border}`,
                  background: targetStatus === t.value ? t.bg : "none",
                  color: t.color, fontWeight: 700, fontSize: "0.82rem",
                  cursor: "pointer", fontFamily: "inherit", transition: "all .15s",
                }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: "0.78rem", fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 5 }}>
            Admin note <span style={{ fontWeight: 400, textTransform: "none" }}>(optional)</span>
          </div>
          <textarea
            style={{ ...inputStyle, minHeight: 70 }}
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Reason for changing status, e.g. 'Re-reviewing after appeal'"
          />
        </div>

        <div style={{ background: T.warningBg, border: "1px solid #fde68a", borderRadius: 10, padding: "10px 14px", marginBottom: 20, display: "flex", gap: 10, alignItems: "flex-start" }}>
          <span style={{ fontSize: "1rem", flexShrink: 0 }}>⚠️</span>
          <div style={{ fontSize: "0.78rem", color: "#92400e", fontWeight: 600 }}>
            This action will be recorded in the audit log. The status change is immediate and visible to the system.
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={onCancel} disabled={loading}
            style={{ padding: "9px 20px", borderRadius: 10, border: `1px solid ${T.border}`, background: "none", color: T.muted, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", fontSize: "0.88rem" }}>
            Cancel
          </button>
          <button onClick={() => onConfirm({ targetStatus, note })} disabled={loading}
            style={{ padding: "9px 22px", borderRadius: 10, border: "none", background: T.info, color: "#fff", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1, fontFamily: "inherit", fontSize: "0.88rem" }}>
            {loading ? "Reverting…" : "Confirm Revert"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Status History Drawer
function StatusHistoryDrawer({ open, item, itemType, onClose }) {
  const [logs,    setLogs]    = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !item) return;
    setLoading(true);
    api.get(`/admin/moderation/history/${itemType}/${item.id}`)
      .then(r => setLogs(r.data ?? []))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, [open, item, itemType]);

  if (!open || !item) return null;

  const actionIcon  = { approved: "✓", rejected: "✕", reverted: "↩", pending: "↺", created: "＋" };
  const actionColor = { approved: T.success, rejected: T.danger, reverted: T.info, pending: T.warning, created: T.muted };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,41,.5)", zIndex: 1700, display: "flex", alignItems: "stretch", justifyContent: "flex-end" }} onClick={onClose}>
      <div style={{ background: T.surface, width: "min(440px, 100vw)", height: "100%", overflowY: "auto", animation: "slideIn .22s ease", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>

        <div style={{ padding: "20px 22px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "sticky", top: 0, background: T.surface, zIndex: 5 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: "1rem", color: T.text }}>📋 Status History</div>
            <div style={{ fontSize: "0.78rem", color: T.muted, marginTop: 3, maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {item.title ?? item.filename ?? item.caption ?? `${itemType} #${item.id}`}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "1.4rem", cursor: "pointer", color: T.muted }}>×</button>
        </div>

        <div style={{ padding: "14px 22px", background: T.bg, borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: "0.8rem", color: T.muted, fontWeight: 600 }}>Current status:</span>
          {statusBadge(item.status ?? "pending")}
        </div>

        <div style={{ padding: "18px 22px", flex: 1 }}>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[...Array(4)].map((_, i) => (
                <div key={i} style={{ display: "flex", gap: 12 }}>
                  <Skeleton w={32} h={32} radius={999} />
                  <div style={{ flex: 1 }}>
                    <Skeleton w="60%" h={12} style={{ marginBottom: 6 }} />
                    <Skeleton w="40%" h={10} />
                  </div>
                </div>
              ))}
            </div>
          ) : logs.length === 0 ? (
            <Empty icon="📭" title="No history yet" subtitle="Actions on this item will appear here." />
          ) : (
            <div style={{ position: "relative" }}>
              <div style={{ position: "absolute", left: 15, top: 0, bottom: 0, width: 2, background: T.border }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {logs.map((log, i) => {
                  const color = actionColor[log.action] ?? T.muted;
                  const icon  = actionIcon[log.action]  ?? "•";
                  return (
                    <div key={log.id ?? i} style={{ display: "flex", gap: 14, paddingBottom: 22, position: "relative" }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: color + "22", border: `2px solid ${color}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.85rem", color, flexShrink: 0, zIndex: 1 }}>
                        {icon}
                      </div>
                      <div style={{ flex: 1, paddingTop: 4 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: "0.85rem", fontWeight: 700, color: T.text, textTransform: "capitalize" }}>{log.action}</span>
                          {log.from_status && log.to_status && (
                            <span style={{ fontSize: "0.75rem", color: T.muted, display: "flex", alignItems: "center", gap: 4 }}>
                              {statusBadge(log.from_status)}<span>→</span>{statusBadge(log.to_status)}
                            </span>
                          )}
                        </div>
                        {log.admin_name && (
                          <div style={{ fontSize: "0.76rem", color: T.muted, marginTop: 2 }}>by <strong>{log.admin_name}</strong></div>
                        )}
                        {log.note && (
                          <div style={{ fontSize: "0.78rem", color: T.text, background: T.bg, borderRadius: 8, padding: "6px 10px", marginTop: 6, fontStyle: "italic" }}>"{log.note}"</div>
                        )}
                        {log.reason && !log.note && (
                          <div style={{ fontSize: "0.78rem", color: T.danger, background: T.dangerBg, borderRadius: 8, padding: "6px 10px", marginTop: 6 }}>Reason: {log.reason}</div>
                        )}
                        <div style={{ fontSize: "0.73rem", color: T.muted, marginTop: 4 }}>{log.created_at_human ?? log.created_at ?? ""}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Revert Button
function RevertButton({ item, onRevert, onHistory, size = "sm" }) {
  const status = item?.status;
  if (!status || status === "pending") return null;

  const pad   = size === "sm" ? "4px 10px" : "7px 14px";
  const fSize = size === "sm" ? "0.72rem"  : "0.82rem";

  return (
    <div style={{ display: "flex", gap: 5 }}>
      {onHistory && (
        <button
          onClick={e => { e.stopPropagation(); onHistory(item); }}
          title="View status history"
          style={{ padding: pad, borderRadius: 7, border: `1px solid ${T.border}`, background: "none", color: T.muted, fontSize: fSize, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
          📋
        </button>
      )}
      <button
        onClick={e => { e.stopPropagation(); onRevert(item); }}
        title="Revert status"
        style={{ padding: pad, borderRadius: 7, border: `1px solid ${T.info}`, background: T.infoBg, color: T.info, fontSize: fSize, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
        ↩ Revert
      </button>
    </div>
  );
}

// Album Form Modal (Media Library)
function AlbumFormModal({ open, album, onSave, onCancel, loading }) {
  const [form, setForm] = useState({ title: "", description: "", type: "general", category: "photos", event_date: "" });

  useEffect(() => {
    if (album) setForm({ title: album.title ?? "", description: album.description ?? "", type: album.type ?? "general", category: album.category ?? "photos", event_date: album.event_date ?? "" });
    else       setForm({ title: "", description: "", type: "general", category: "photos", event_date: "" });
  }, [album, open]);

  if (!open) return null;

  const inputStyle = { width: "100%", padding: "9px 12px", borderRadius: 10, border: `1px solid ${T.border}`, fontSize: "0.88rem", color: T.text, fontFamily: "inherit", outline: "none", boxSizing: "border-box" };

  const Field = ({ label, children }) => (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: T.muted, marginBottom: 5, textTransform: "uppercase", letterSpacing: ".04em" }}>{label}</label>
      {children}
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,41,.55)", zIndex: 1800, display: "grid", placeItems: "center", padding: 20 }} onClick={onCancel}>
      <div style={{ background: T.surface, borderRadius: 20, padding: "26px 28px", width: "100%", maxWidth: 480, boxShadow: T.shadowMd, animation: "fadeIn .18s ease" }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: "1.05rem", fontWeight: 800, color: T.text, marginBottom: 18 }}>{album ? "Edit Album" : "Create Album"}</div>

        <Field label="Title">
          <input style={inputStyle} value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Album title" />
        </Field>
        <Field label="Description">
          <textarea style={{ ...inputStyle, resize: "vertical", minHeight: 72 }} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Optional description" />
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Type">
            <select style={inputStyle} value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
              <option value="general">General</option>
              <option value="graduation">Graduation</option>
              <option value="profile">Profile</option>
            </select>
          </Field>
          <Field label="Category">
            <select style={inputStyle} value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
              <option value="photos">Photos</option>
              <option value="videos">Videos</option>
              <option value="program">Program</option>
              <option value="archive">Archive</option>
            </select>
          </Field>
        </div>
        <Field label="Event Date">
          <input type="date" style={inputStyle} value={form.event_date} onChange={e => setForm(p => ({ ...p, event_date: e.target.value }))} />
        </Field>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
          <button onClick={onCancel} disabled={loading}
            style={{ padding: "9px 20px", borderRadius: 10, border: `1px solid ${T.border}`, background: "none", color: T.muted, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", fontSize: "0.88rem" }}>
            Cancel
          </button>
          <button onClick={() => onSave(form)} disabled={loading || !form.title}
            style={{ padding: "9px 20px", borderRadius: 10, border: "none", background: T.primary, color: "#fff", fontWeight: 700, cursor: (!form.title || loading) ? "not-allowed" : "pointer", opacity: (!form.title || loading) ? 0.6 : 1, fontFamily: "inherit", fontSize: "0.88rem" }}>
            {loading ? "Saving…" : album ? "Save Changes" : "Create Album"}
          </button>
        </div>
      </div>
    </div>
  );
}


// MODERATION SHARED COMPONENTS


// Album Drill-Down Panel (Moderation)
function AlbumDrillPanel({ album, onClose, onApproveAlbum, onRejectAlbum, onApprovePhoto, onRejectPhoto, onRevertPhoto, onHistoryPhoto, onFlagAvatar, loading }) {
  const [lightbox,    setLightbox]    = useState(null);
  const [lightboxIdx, setLightboxIdx] = useState(0);

  if (!album) return null;

  const photos    = album.photos ?? [];
  const isPending = album.status === "pending";

  const openLightbox  = (photo, idx) => { setLightbox(photo); setLightboxIdx(idx); };
  const closeLightbox = () => setLightbox(null);

  const goPrev = e => {
    e.stopPropagation();
    const idx = (lightboxIdx - 1 + photos.length) % photos.length;
    setLightbox(photos[idx]); setLightboxIdx(idx);
  };
  const goNext = e => {
    e.stopPropagation();
    const idx = (lightboxIdx + 1) % photos.length;
    setLightbox(photos[idx]); setLightboxIdx(idx);
  };

  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,41,.6)", zIndex: 1200, display: "flex", alignItems: "stretch", justifyContent: "flex-end" }} onClick={onClose}>
        <div style={{ background: T.surface, width: "min(780px, 100vw)", height: "100%", overflowY: "auto", animation: "slideIn .22s ease", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>

          <div style={{ padding: "20px 24px", borderBottom: `1px solid ${T.border}`, display: "flex", gap: 14, alignItems: "flex-start", position: "sticky", top: 0, background: T.surface, zIndex: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 900, fontSize: "1.1rem", color: T.text }}>📂 {album.title}</div>
              <div style={{ fontSize: "0.8rem", color: T.muted, marginTop: 3 }}>
                Uploaded by <strong>{album.uploader}</strong> · {album.created_at_human} · {photos.length} photo{photos.length !== 1 ? "s" : ""}
              </div>
            </div>
            {isPending && (
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button onClick={() => onRejectAlbum(album)}
                  style={{ padding: "8px 14px", borderRadius: 10, border: `1px solid ${T.danger}`, background: "transparent", color: T.danger, fontWeight: 700, fontSize: "0.82rem", cursor: "pointer", fontFamily: "inherit" }}>
                  Reject All
                </button>
                <button onClick={() => onApproveAlbum(album)} disabled={loading}
                  style={{ padding: "8px 14px", borderRadius: 10, border: "none", background: T.success, color: "#fff", fontWeight: 700, fontSize: "0.82rem", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1, fontFamily: "inherit" }}>
                  Approve All
                </button>
              </div>
            )}
            <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer", color: T.muted, lineHeight: 1 }}>×</button>
          </div>

          <div style={{ padding: "20px 24px", flex: 1 }}>
            {photos.length === 0 ? (
              <Empty icon="📭" title="No photos in this album." subtitle="" />
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 14 }}>
                {photos.map((photo, idx) => (
                  <div key={photo.id}
                    style={{ borderRadius: 14, overflow: "hidden", border: `1.5px solid ${T.border}`, background: T.surface, boxShadow: T.shadow, transition: "transform .15s" }}
                    onMouseEnter={e => e.currentTarget.style.transform = "scale(1.02)"}
                    onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}>

                    <div style={{ height: 150, background: "#0d1528", position: "relative", cursor: "pointer", overflow: "hidden" }} onClick={() => openLightbox(photo, idx)}>
                      {photo.url
                        ? <MediaPreview item={photo} src={photo.url} alt={photo.caption} />
                        : <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#ffffff44", fontSize: "2rem" }}>🖼</div>
                      }
                    </div>

                    <div style={{ padding: "10px 12px" }}>
                      {photo.caption && (
                        <div style={{ fontSize: "0.78rem", color: T.muted, marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {photo.caption}
                        </div>
                      )}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 4 }}>
                        {statusBadge(photo.status)}
                        {photo.status === "pending" ? (
                          <div style={{ display: "flex", gap: 5 }}>
                            {photo.is_profile_post && (
                              <button onClick={() => onFlagAvatar(photo)}
                                style={{ padding: "4px 9px", borderRadius: 7, border: "none", background: T.warningBg, color: T.warning, fontSize: "0.72rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Flag Avatar</button>
                            )}
                            <ModerationDecisionButtons
                              onReject={() => onRejectPhoto(photo)}
                              onApprove={() => onApprovePhoto(photo)}
                            />
                          </div>
                        ) : (
                          <RevertButton item={photo} onRevert={onRevertPhoto} onHistory={onHistoryPhoto} size="sm" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {lightbox && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(5,10,25,.92)", zIndex: 2100, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }} onClick={closeLightbox}>
          <div style={{ position: "relative", maxWidth: "90vw", maxHeight: "85vh", display: "flex", flexDirection: "column", alignItems: "center" }} onClick={e => e.stopPropagation()}>
            {photos.length > 1 && (
              <>
                <button onClick={goPrev} style={{ position: "absolute", left: -52, top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,.12)", border: "none", color: "#fff", fontSize: "1.6rem", width: 40, height: 40, borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>‹</button>
                <button onClick={goNext} style={{ position: "absolute", right: -52, top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,.12)", border: "none", color: "#fff", fontSize: "1.6rem", width: 40, height: 40, borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>›</button>
              </>
            )}
            {mediaKind(lightbox) === "video" ? (
              <video src={lightbox.url} controls style={{ maxWidth: "90vw", maxHeight: "72vh", borderRadius: 14, objectFit: "contain", boxShadow: "0 8px 60px rgba(0,0,0,.6)", background: "#000" }} />
            ) : (
              <img src={lightbox.url} alt={lightbox.caption} style={{ maxWidth: "90vw", maxHeight: "72vh", borderRadius: 14, objectFit: "contain", boxShadow: "0 8px 60px rgba(0,0,0,.6)" }} />
            )}
            <div style={{ marginTop: 14, background: "rgba(255,255,255,.08)", backdropFilter: "blur(8px)", borderRadius: 12, padding: "10px 18px", display: "flex", alignItems: "center", gap: 14, minWidth: 300, maxWidth: 560, justifyContent: "space-between" }}>
              <div>
                <div style={{ color: "#fff", fontWeight: 700, fontSize: "0.86rem" }}>{lightbox.caption || "No caption"}</div>
                <div style={{ color: "rgba(255,255,255,.5)", fontSize: "0.75rem", marginTop: 2 }}>{lightbox.created_at_human}</div>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0, alignItems: "center" }}>
                {lightbox.status === "pending" ? (
                  <>
                    {lightbox.is_profile_post && (
                      <button onClick={() => { onFlagAvatar(lightbox); closeLightbox(); }}
                        style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: T.warningBg, color: T.warning, fontWeight: 700, fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit" }}>Flag Avatar</button>
                    )}
                    <ModerationDecisionButtons
                      onReject={() => { onRejectPhoto(lightbox); closeLightbox(); }}
                      onApprove={() => { onApprovePhoto(lightbox); closeLightbox(); }}
                    />
                  </>
                ) : (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {statusBadge(lightbox.status)}
                    <button onClick={() => { onRevertPhoto(lightbox); closeLightbox(); }}
                      style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${T.info}`, background: "rgba(8,145,178,.15)", color: "#67e8f9", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit" }}>↩ Revert</button>
                  </div>
                )}
              </div>
            </div>
            {photos.length > 1 && (
              <div style={{ marginTop: 10, color: "rgba(255,255,255,.4)", fontSize: "0.78rem" }}>{lightboxIdx + 1} / {photos.length}</div>
            )}
          </div>
          <button onClick={closeLightbox} style={{ position: "absolute", top: 18, right: 22, background: "rgba(255,255,255,.1)", border: "none", color: "#fff", fontSize: "1.4rem", width: 36, height: 36, borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
        </div>
      )}
    </>
  );
}

// Album Card (Moderation queue)
function ModerationAlbumCard({ album, selected, onSelect, onOpen, onApprove, onReject, onRevert, onHistory }) {
  const photos    = album.photos ?? [];
  const isPending = album.status === "pending";
  const isGraduationPending = isPending && /graduation/i.test(`${album.title ?? ""} ${album.category ?? ""} ${album.type ?? ""}`);
  const thumbs    = photos.slice(0, 4);
  const extra     = photos.length - 4;

  return (
    <div
      style={{ background: T.surface, border: `2px solid ${selected ? T.primary : T.border}`, borderRadius: 18, overflow: "hidden", boxShadow: T.shadow, transition: "all .15s", transform: selected ? "scale(1.01)" : "scale(1)", cursor: "pointer" }}
      onClick={() => onOpen(album)}>

      {isPending && (
        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", top: 10, left: 10, zIndex: 3 }} onClick={e => { e.stopPropagation(); onSelect(album.id); }}>
            <input type="checkbox" checked={selected} onChange={() => {}} style={{ width: 18, height: 18, accentColor: T.primary, cursor: "pointer" }} />
          </div>
        </div>
      )}

      <div style={{ height: 170, background: "#0d1528", position: "relative", overflow: "hidden" }}>
        {album.cover_url ? (
          <MediaPreview item={{ resource_type: album.cover_resource_type ?? "image" }} src={album.cover_url} alt={album.title} />
        ) : thumbs.length > 1 ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", height: "100%", gap: 2 }}>
            {thumbs.map((p, i) => (
              <div key={p.id} style={{ position: "relative", overflow: "hidden" }}>
                {p.url ? <MediaPreview item={p} src={p.url} alt="" /> : <div style={{ background: "#1a2540", width: "100%", height: "100%" }} />}
                {i === 3 && extra > 0 && (
                  <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: "1.1rem" }}>+{extra}</div>
                )}
              </div>
            ))}
          </div>
        ) : thumbs.length === 1 ? (
          <MediaPreview item={thumbs[0]} src={thumbs[0].url} alt="" />
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#ffffff33", fontSize: "2.5rem" }}>📂</div>
        )}
        <div style={{ position: "absolute", bottom: 8, right: 8, background: "rgba(0,0,0,.65)", color: "#fff", fontSize: "0.72rem", fontWeight: 700, padding: "3px 8px", borderRadius: 20, backdropFilter: "blur(4px)" }}>
          {photos.length} photo{photos.length !== 1 ? "s" : ""}
        </div>
      </div>

      <div style={{ padding: "12px 14px" }}>
        <div style={{ fontSize: "0.88rem", fontWeight: 800, color: T.text, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{album.title}</div>
        <div style={{ fontSize: "0.75rem", color: T.muted, marginBottom: 10 }}>{album.uploader} · {album.created_at_human}</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
          {statusBadge(album.status)}
          {isGraduationPending && (
            <div style={{ flexBasis: "100%", background: T.warningBg, color: T.warning, fontSize: "0.72rem", fontWeight: 800, padding: "6px 8px", borderRadius: 8 }}>
              Graduation upload pending review - do not publish without approval.
            </div>
          )}
          {isPending ? (
            <div style={{ display: "flex", gap: 6 }} onClick={e => e.stopPropagation()}>
              <ModerationDecisionButtons
                onReject={() => onReject(album)}
                onApprove={() => onApprove(album)}
              />
            </div>
          ) : (
            <div onClick={e => e.stopPropagation()}>
              <RevertButton item={album} onRevert={onRevert} onHistory={onHistory} size="sm" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Generic Content Card (video / voice / reported)
function ModerationContentCard({ item, type, selected, onSelect, onPreview, onApprove, onReject, onRevert, onHistory }) {
  const isAudio   = type === "voice";
  const isPending = !item.status || item.status === "pending";
  const mediaSrc  = item.url ?? item.file_path ?? item.video_url ?? null;
  const isGraduationPending = isPending && item.source === "graduation";

  return (
    <div style={{ background: T.surface, border: `2px solid ${selected ? T.primary : T.border}`, borderRadius: 16, overflow: "hidden", boxShadow: T.shadow, transition: "all .15s", position: "relative", transform: selected ? "scale(1.01)" : "scale(1)" }}>
      {isPending && (
        <div style={{ position: "absolute", top: 10, left: 10, zIndex: 2 }}>
          <input type="checkbox" checked={selected} onChange={() => onSelect(item.id)} style={{ width: 18, height: 18, accentColor: T.primary, cursor: "pointer" }} />
        </div>
      )}

      <div onClick={() => onPreview(item)} style={{ height: 160, background: "#0f1729", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", position: "relative", overflow: "hidden" }}>
        {!isAudio && mediaSrc && <MediaPreview item={item} src={mediaSrc} />}
        {(isAudio || !mediaSrc) && (isAudio
          ? <div style={{ textAlign: "center", color: "#ffffff99" }}><div style={{ fontSize: "2.5rem" }}>🎙</div><div style={{ fontSize: "0.78rem", marginTop: 6 }}>Tap to listen</div></div>
          : <div style={{ textAlign: "center", color: "#ffffff99" }}><div style={{ fontSize: "2.5rem" }}>🎬</div><div style={{ fontSize: "0.78rem", marginTop: 6 }}>Tap to preview</div></div>
        )}
        {item.ai_flags && (
          <div style={{ position: "absolute", top: 8, right: 8, background: T.warning, color: "#fff", fontSize: "0.7rem", fontWeight: 700, padding: "2px 7px", borderRadius: 6 }}>AI FLAG</div>
        )}
      </div>

      <div style={{ padding: "12px 14px" }}>
        <div style={{ fontSize: "0.84rem", fontWeight: 700, color: T.text, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.filename ?? item.title ?? "Untitled"}</div>
        <div style={{ fontSize: "0.75rem", color: T.muted, marginBottom: 10 }}>{item.uploader ?? item.user_name ?? "Unknown"} · {item.created_at_human ?? ""}</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
          {statusBadge(item.status ?? "pending")}
          {isGraduationPending && (
            <div style={{ flexBasis: "100%", background: T.warningBg, color: T.warning, fontSize: "0.72rem", fontWeight: 800, padding: "6px 8px", borderRadius: 8 }}>
              Graduation upload pending review - do not publish without approval.
            </div>
          )}
          {isPending ? (
            <div style={{ display: "flex", gap: 6 }}>
              <ModerationDecisionButtons
                onReject={() => onReject(item)}
                onApprove={() => onApprove(item)}
              />
            </div>
          ) : (
            <RevertButton item={item} onRevert={onRevert} onHistory={onHistory} size="sm" />
          )}
        </div>
      </div>
    </div>
  );
}

// Generic Preview Modal
function GenericPreviewModal({ item, type, onClose, onApprove, onReject, onRevert, onHistory, loading }) {
  if (!item) return null;

  const isVideo   = type === "video";
  const isAudio   = type === "voice";
  const isPending = !item.status || item.status === "pending";

  const videoSrc = item.url ?? item.file_path ?? item.video_url ?? null;
  const audioSrc = item.url ?? item.audio_url ?? item.file_path ?? null;
  const hasMedia = isVideo ? !!videoSrc : isAudio ? !!audioSrc : false;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,41,.75)", zIndex: 1500, display: "grid", placeItems: "center", padding: 20 }} onClick={onClose}>
      <div style={{ background: T.surface, borderRadius: 24, width: "100%", maxWidth: 620, boxShadow: T.shadowLg, animation: "fadeIn .18s ease", overflow: "hidden" }} onClick={e => e.stopPropagation()}>

        <div style={{ padding: "18px 22px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 800, color: T.text, fontSize: "1rem" }}>{item.filename ?? item.title ?? "Preview"}</div>
            <div style={{ fontSize: "0.8rem", color: T.muted, marginTop: 2 }}>
              by <strong>{item.uploader ?? item.user_name ?? "Unknown"}</strong> · {item.created_at_human ?? ""}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {onHistory && (
              <button onClick={() => onHistory(item)}
                style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${T.border}`, background: "none", color: T.muted, fontSize: "0.8rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                📋 History
              </button>
            )}
            <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "1.4rem", cursor: "pointer", color: T.muted }}>×</button>
          </div>
        </div>

        <div style={{ padding: "20px 22px", background: "#0f1729", display: "flex", justifyContent: "center", alignItems: "center", minHeight: 260 }}>
          {isVideo && videoSrc && (
            <video key={videoSrc} src={videoSrc} controls autoPlay={false}
              style={{ maxWidth: "100%", maxHeight: 380, borderRadius: 12, background: "#000", display: "block" }} />
          )}
          {isAudio && audioSrc && (
            <div style={{ width: "100%", padding: "8px 0" }}>
              <div style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 16, padding: "20px 22px", display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(66,84,197,.35)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.6rem", flexShrink: 0 }}>🎙</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: "#fff", fontWeight: 700, fontSize: "0.9rem", marginBottom: 2 }}>{item.title ?? item.filename ?? "Audio"}</div>
                  <div style={{ color: "rgba(255,255,255,.45)", fontSize: "0.76rem", marginBottom: 12 }}>
                    {item.uploader ?? item.user_name ?? "Unknown"}
                    {item.duration_seconds ? ` · ${item.duration_seconds}s` : ""}
                    {item.created_at_human ? ` · ${item.created_at_human}` : ""}
                  </div>
                  <audio key={audioSrc} src={audioSrc} controls style={{ width: "100%", height: 36, accentColor: T.primary }} />
                </div>
              </div>
            </div>
          )}
          {!hasMedia && (
            <div style={{ textAlign: "center", color: "#ffffff55" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: 10 }}>{isAudio ? "🎙" : "🎬"}</div>
              <div style={{ fontSize: "0.9rem" }}>No preview available</div>
            </div>
          )}
        </div>

        <div style={{ padding: "16px 22px", borderTop: `1px solid ${T.border}`, display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
          <button onClick={onClose}
            style={{ padding: "9px 20px", borderRadius: 10, border: `1px solid ${T.border}`, background: "none", color: T.muted, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", fontSize: "0.88rem" }}>
            Close
          </button>
          {isPending ? (
            <>
              <ModerationDecisionButtons
                onReject={() => onReject(item)}
                onApprove={() => onApprove(item)}
                disabled={loading}
              />
            </>
          ) : (
            <button onClick={() => { onClose(); onRevert(item); }} disabled={loading}
              style={{ padding: "9px 20px", borderRadius: 10, border: "none", background: T.infoBg, color: T.info, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1, fontFamily: "inherit", fontSize: "0.88rem" }}>
              ↩ Revert Status
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


// MODERATION MODE


const MOD_TABS = [
  { key: "photo",    label: "Photos"      },
  { key: "video",    label: "Videos"      },
  { key: "reported", label: "Reported"    },
];

function ModerationMode({ toast }) {
  const [activeTab,     setActiveTab]     = useState("photo");
  const [statusFilter,  setStatusFilter]  = useState("pending");
  const [items,         setItems]         = useState([]);
  const [meta,          setMeta]          = useState(null);
  const [page,          setPage]          = useState(1);
  const [loading,       setLoading]       = useState(true);
  const [actLoading,    setActLoading]    = useState(false);
  const [counts,        setCounts]        = useState({});
  const [selected,      setSelected]      = useState([]);
  const [openAlbum,     setOpenAlbum]     = useState(null);
  const [preview,       setPreview]       = useState(null);
  const [rejectTarget,  setRejectTarget]  = useState(null);
  const [approveTarget, setApproveTarget] = useState(null);
  const [revertTarget,  setRevertTarget]  = useState(null);
  const [historyTarget, setHistoryTarget] = useState(null);

  const fetchItems = useCallback(async (tab = activeTab, status = statusFilter, p = 1) => {
    setLoading(true); setSelected([]);
    try {
      const res = await api.get("/admin/moderation/queue", { params: { type: tab, status, page: p, per_page: 12 } });
      setItems(res.data.data ?? []); setMeta(res.data.meta ?? null);
    } catch { toast("Failed to load queue.", "error"); }
    finally { setLoading(false); }
  }, [activeTab, statusFilter]);

  const fetchCounts = useCallback(async () => {
    try { const res = await api.get("/admin/moderation/counts"); setCounts(res.data ?? {}); } catch {}
  }, []);

  useEffect(() => { fetchItems(activeTab, statusFilter, page); }, [activeTab, statusFilter, page]);
  useEffect(() => { fetchCounts(); }, []);

  const switchTab    = tab => { setActiveTab(tab); setPage(1); setStatusFilter("pending"); };
  const switchStatus = s   => { setStatusFilter(s); setPage(1); };
  const refresh      = ()  => { fetchItems(activeTab, statusFilter, page); fetchCounts(); };

  const toggleSelect = id => setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const selectAll    = () => setSelected(items.filter(i => !i.status || i.status === "pending").map(i => i.id));
  const clearSelect  = () => setSelected([]);

  const requestApproveAlbum = album => setApproveTarget({ kind: "album", payload: album, label: album?.title || "this album" });
  const requestApprovePhoto = photo => setApproveTarget({ kind: "photo", payload: photo, label: photo?.caption || photo?.filename || "this photo" });
  const requestApproveItem = item => setApproveTarget({ kind: "item", payload: item, label: item?.filename || item?.title || "this content" });
  const requestBulkApprove = () => {
    if (!selected.length) return;
    setApproveTarget({ kind: "bulk", payload: null, count: selected.length, label: `${selected.length} selected items` });
  };

  const doApproveAlbum = async album => {
    setActLoading(true);
    try {
      await api.post(`/admin/moderation/photo/album/${album.id}/approve`);
      toast(`✓ Album "${album.title}" approved.`);
      setOpenAlbum(null); refresh();
    } catch { toast("Approve failed.", "error"); }
    finally { setActLoading(false); }
  };

  const doRejectAlbum = async reason => {
    const album = rejectTarget?.payload;
    setActLoading(true);
    try {
      await api.post(`/admin/moderation/photo/album/${album.id}/reject`, { reason });
      toast(`✕ Album "${album.title}" rejected.`);
      setOpenAlbum(null); setRejectTarget(null); refresh();
    } catch { toast("Reject failed.", "error"); }
    finally { setActLoading(false); }
  };

  const doApprovePhoto = async photo => {
    setActLoading(true);
    try {
      await api.post(`/admin/moderation/photo/${photo.id}/approve`);
      toast("✓ Photo approved.");
      setOpenAlbum(prev => prev ? { ...prev, photos: prev.photos.map(p => p.id === photo.id ? { ...p, status: "approved" } : p) } : null);
      fetchCounts();
    } catch { toast("Approve failed.", "error"); }
    finally { setActLoading(false); }
  };

  const doRejectPhoto = async reason => {
    const photo = rejectTarget?.payload;
    setActLoading(true);
    try {
      await api.post(`/admin/moderation/photo/${photo.id}/reject`, { reason });
      toast("✕ Photo rejected.");
      setOpenAlbum(prev => prev ? { ...prev, photos: prev.photos.map(p => p.id === photo.id ? { ...p, status: "rejected", rejection_reason: reason } : p) } : null);
      setRejectTarget(null); fetchCounts();
    } catch { toast("Reject failed.", "error"); }
    finally { setActLoading(false); }
  };

  const doFlagAvatar = async photo => {
    setActLoading(true);
    try {
      await api.post(`/admin/moderation/photo/${photo.id}/flag-avatar`);
      toast("Avatar flagged and reset to the default placeholder.", "info");
      setOpenAlbum(prev => prev ? { ...prev, photos: prev.photos.map(p => p.id === photo.id ? { ...p, status: "pending" } : p) } : null);
      fetchCounts();
    } catch { toast("Flag avatar failed.", "error"); }
    finally { setActLoading(false); }
  };

  const doApproveItem = async item => {
    setActLoading(true);
    try {
      await api.post(`/admin/moderation/${activeTab}/${item.id}/approve`, { source: item.source });
      toast("✓ Approved."); setPreview(null); refresh();
    } catch { toast("Approve failed.", "error"); }
    finally { setActLoading(false); }
  };

  const doRejectItem = async reason => {
    const item = rejectTarget?.payload;
    setActLoading(true);
    try {
      await api.post(`/admin/moderation/${activeTab}/${item.id}/reject`, { reason, source: item.source });
      toast("✕ Rejected."); setPreview(null); setRejectTarget(null); refresh();
    } catch { toast("Reject failed.", "error"); }
    finally { setActLoading(false); }
  };

  const doRevert = async ({ targetStatus, note }) => {
    if (!revertTarget) return;
    const { item, type } = revertTarget;
    setActLoading(true);
    try {
      let endpoint;
      if (type === "album") endpoint = `/admin/moderation/photo/album/${item.id}/revert`;
      else if (type === "photo") endpoint = `/admin/moderation/photo/${item.id}/revert`;
      else endpoint = `/admin/moderation/${activeTab}/${item.id}/revert`;

      await api.post(endpoint, { status: targetStatus, note, source: item.source });
      toast(`↩ Status changed to "${targetStatus}".`, "info");
      setRevertTarget(null);

      if (type === "photo" && openAlbum) {
        setOpenAlbum(prev => prev ? { ...prev, photos: prev.photos.map(p => p.id === item.id ? { ...p, status: targetStatus } : p) } : null);
        fetchCounts();
      } else {
        setOpenAlbum(null); setPreview(null); refresh();
      }
    } catch { toast("Revert failed.", "error"); }
    finally { setActLoading(false); }
  };

  const doBulkApprove = async () => {
    if (!selected.length) return;
    setActLoading(true);
    try {
      await api.post("/admin/moderation/bulk-approve", { type: activeTab, ids: selected });
      toast(`✓ Approved ${selected.length} item${selected.length > 1 ? "s" : ""}.`);
      clearSelect(); refresh();
    } catch { toast("Bulk approve failed.", "error"); }
    finally { setActLoading(false); }
  };

  const doBulkReject = async reason => {
    setActLoading(true);
    try {
      await api.post("/admin/moderation/bulk-reject", { type: activeTab, ids: selected, reason });
      toast(`✕ Rejected ${selected.length} item${selected.length > 1 ? "s" : ""}.`);
      clearSelect(); setRejectTarget(null); refresh();
    } catch { toast("Bulk reject failed.", "error"); }
    finally { setActLoading(false); }
  };

  const handleApproveConfirm = async () => {
    const target = approveTarget;
    if (!target) return;

    if (target.kind === "album") await doApproveAlbum(target.payload);
    if (target.kind === "photo") await doApprovePhoto(target.payload);
    if (target.kind === "item") await doApproveItem(target.payload);
    if (target.kind === "bulk") await doBulkApprove();

    setApproveTarget(null);
  };

  const openPreview = useCallback(async item => {
    const hasSrc = item.url || item.file_path || item.audio_url || item.video_url;
    if (hasSrc) { setPreview(item); return; }
    try {
      const res = await api.get(`/admin/moderation/${activeTab}/${item.id}`);
      setPreview(res.data ?? item);
    } catch { setPreview(item); }
  }, [activeTab]);

  const handleRejectConfirm = reason => {
    const kind = rejectTarget?.kind;
    if (kind === "album") return doRejectAlbum(reason);
    if (kind === "photo") return doRejectPhoto(reason);
    if (kind === "item")  return doRejectItem(reason);
    if (kind === "bulk")  return doBulkReject(reason);
  };

  const isPhotoTab = activeTab === "photo";

  const rejectModalTitle =
    rejectTarget?.kind === "album" ? `Reject Album: "${rejectTarget.payload?.title}"` :
    rejectTarget?.kind === "photo" ? "Reject Photo" :
    rejectTarget?.kind === "bulk"  ? `Bulk Reject ${selected.length} items` :
    "Reject Content";

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {MOD_TABS.map(t => {
          const cnt = counts[t.key];
          return (
            <button key={t.key} onClick={() => switchTab(t.key)}
              style={{ padding: "9px 18px", borderRadius: 12, border: `1.5px solid ${activeTab === t.key ? T.primary : T.border}`, background: activeTab === t.key ? T.primary : T.surface, color: activeTab === t.key ? "#fff" : T.text, fontWeight: 700, fontSize: "0.86rem", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8, transition: "all .15s" }}>
              {t.label}
              {cnt > 0 && (
                <span style={{ background: activeTab === t.key ? "rgba(255,255,255,.3)" : T.dangerBg, color: activeTab === t.key ? "#fff" : T.danger, fontSize: "0.72rem", fontWeight: 800, padding: "1px 7px", borderRadius: 999 }}>{cnt}</span>
              )}
            </button>
          );
        })}
      </div>

      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: "14px 18px", marginBottom: 20, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", boxShadow: T.shadow }}>
        <div style={{ display: "flex", gap: 6 }}>
          {["pending", "approved", "rejected"].map(s => (
            <button key={s} onClick={() => switchStatus(s)}
              style={{ padding: "6px 16px", borderRadius: 20, border: `1px solid ${statusFilter === s ? T.primary : T.border}`, background: statusFilter === s ? "#edf2ff" : "none", color: statusFilter === s ? T.primary : T.muted, fontWeight: 700, fontSize: "0.82rem", cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize" }}>
              {s}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        {selected.length > 0 && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", animation: "fadeIn .15s ease" }}>
            <span style={{ fontSize: "0.84rem", fontWeight: 600, color: T.muted }}>{selected.length} selected</span>
            <button onClick={clearSelect} style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${T.border}`, background: "none", color: T.muted, fontSize: "0.82rem", cursor: "pointer", fontFamily: "inherit" }}>Clear</button>
            <button onClick={requestBulkApprove} disabled={actLoading} style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: T.success, color: "#fff", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer", fontFamily: "inherit" }}>Approve All</button>
            <button onClick={() => setRejectTarget({ kind: "bulk", payload: null })} disabled={actLoading} style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${T.danger}`, background: "transparent", color: T.danger, fontWeight: 700, fontSize: "0.82rem", cursor: "pointer", fontFamily: "inherit" }}>Reject All</button>
          </div>
        )}
        {statusFilter === "pending" && items.length > 0 && selected.length === 0 && (
          <button onClick={selectAll} style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${T.border}`, background: "none", color: T.primary, fontWeight: 600, fontSize: "0.82rem", cursor: "pointer", fontFamily: "inherit" }}>
            Select All {isPhotoTab ? "Albums" : ""}
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} style={{ background: T.surface, borderRadius: 16, overflow: "hidden", border: `1px solid ${T.border}` }}>
              <Skeleton w="100%" h={170} radius={0} />
              <div style={{ padding: 14 }}><Skeleton w="70%" h={13} style={{ marginBottom: 8 }} /><Skeleton w="50%" h={11} /></div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <Empty
          icon={statusFilter === "pending" ? "🎉" : "📭"}
          title={statusFilter === "pending" ? "Queue is clear!" : `No ${statusFilter} content.`}
          subtitle={statusFilter === "pending" ? "All content has been reviewed." : "Nothing to show here."}
        />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
          {items.map(item =>
            isPhotoTab ? (
              <ModerationAlbumCard
                key={item.id} album={item}
                selected={selected.includes(item.id)}
                onSelect={toggleSelect}
                onOpen={setOpenAlbum}
                onApprove={requestApproveAlbum}
                onReject={album => setRejectTarget({ kind: "album", payload: album })}
                onRevert={album => setRevertTarget({ item: album, type: "album" })}
                onHistory={album => setHistoryTarget({ item: album, type: "photo" })}
              />
            ) : (
              <ModerationContentCard
                key={item.id} item={item} type={activeTab}
                selected={selected.includes(item.id)}
                onSelect={toggleSelect}
                onPreview={openPreview}
                onApprove={requestApproveItem}
                onReject={item => setRejectTarget({ kind: "item", payload: item })}
                onRevert={item => setRevertTarget({ item, type: "item" })}
                onHistory={item => setHistoryTarget({ item, type: activeTab })}
              />
            )
          )}
        </div>
      )}

      <Pagination meta={meta} onPage={p => setPage(p)} />

      <AlbumDrillPanel
        album={openAlbum}
        onClose={() => setOpenAlbum(null)}
        onApproveAlbum={requestApproveAlbum}
        onRejectAlbum={album => setRejectTarget({ kind: "album", payload: album })}
        onApprovePhoto={requestApprovePhoto}
        onRejectPhoto={photo => setRejectTarget({ kind: "photo", payload: photo })}
        onRevertPhoto={photo => setRevertTarget({ item: photo, type: "photo" })}
        onHistoryPhoto={photo => setHistoryTarget({ item: photo, type: "photo" })}
        onFlagAvatar={doFlagAvatar}
        loading={actLoading}
      />

      <GenericPreviewModal
        item={preview} type={activeTab}
        onClose={() => setPreview(null)}
        onApprove={requestApproveItem}
        onReject={item => { setPreview(null); setRejectTarget({ kind: "item", payload: item }); }}
        onRevert={item => setRevertTarget({ item, type: "item" })}
        onHistory={item => setHistoryTarget({ item, type: activeTab })}
        loading={actLoading}
      />

      <RejectModal
        open={!!rejectTarget}
        title={rejectModalTitle}
        onConfirm={handleRejectConfirm}
        onCancel={() => setRejectTarget(null)}
        loading={actLoading}
      />

      <ApproveConfirmModal
        open={!!approveTarget}
        target={approveTarget}
        onConfirm={handleApproveConfirm}
        onCancel={() => setApproveTarget(null)}
        loading={actLoading}
      />

      <RevertModal
        open={!!revertTarget}
        item={revertTarget?.item}
        itemType={revertTarget?.type}
        onConfirm={doRevert}
        onCancel={() => setRevertTarget(null)}
        loading={actLoading}
      />

      <StatusHistoryDrawer
        open={!!historyTarget}
        item={historyTarget?.item}
        itemType={historyTarget?.type}
        onClose={() => setHistoryTarget(null)}
      />
    </div>
  );
}


// MEDIA LIBRARY ALBUM DRILL-DOWN PANEL


/**
 * LibraryAlbumDrillPanel
 *
 * Slide-out panel that opens when an admin clicks an album card in the Media
 * Library. Fetches all photos from GET /admin/media/albums/{id}/photos and
 * renders them in a grid with lightbox + per-photo delete.
 */
function LibraryAlbumDrillPanel({ album, onClose, toast }) {
  const [photos,       setPhotos]       = useState([]);
  const [meta,         setMeta]         = useState(null);
  const [page,         setPage]         = useState(1);
  const [loading,      setLoading]      = useState(false);
  const [actLoading,   setActLoading]   = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [lightbox,     setLightbox]     = useState(null);
  const [lightboxIdx,  setLightboxIdx]  = useState(0);
  const [visFilter,    setVisFilter]    = useState("all");

  // Fetch photos whenever the album or page changes
  useEffect(() => {
    if (!album) { setPhotos([]); setMeta(null); setPage(1); return; }
    setLoading(true);
    const params = { page, per_page: 48 };
    if (visFilter !== "all") params.visibility = visFilter;

    api.get(`/admin/media/albums/${album.id}/photos`, { params })
      .then(r => {
        // Support both paginated { data: [...], meta: {...} } and plain array
        if (Array.isArray(r.data)) {
          setPhotos(r.data);
          setMeta(null);
        } else {
          setPhotos(r.data.data ?? []);
          setMeta(r.data.meta ?? null);
        }
      })
      .catch(() => toast("Failed to load photos.", "error"))
      .finally(() => setLoading(false));
  }, [album, page, visFilter]);

  // Reset when album changes
  useEffect(() => {
    if (album) { setPage(1); setVisFilter("all"); }
  }, [album?.id]);

  const handleDelete = async () => {
    setActLoading(true);
    try {
      await api.delete(`/admin/media/photos/${deleteTarget.id}`);
      toast("Photo deleted.");
      setPhotos(p => p.filter(x => x.id !== deleteTarget.id));
      // Close lightbox if it was showing the deleted photo
      if (lightbox?.id === deleteTarget.id) setLightbox(null);
      setDeleteTarget(null);
    } catch { toast("Delete failed.", "error"); }
    finally { setActLoading(false); }
  };

  const openLightbox = (photo, idx) => { setLightbox(photo); setLightboxIdx(idx); };

  const goPrev = e => {
    e.stopPropagation();
    const i = (lightboxIdx - 1 + photos.length) % photos.length;
    setLightbox(photos[i]); setLightboxIdx(i);
  };
  const goNext = e => {
    e.stopPropagation();
    const i = (lightboxIdx + 1) % photos.length;
    setLightbox(photos[i]); setLightboxIdx(i);
  };

  if (!album) return null;

  const visColor = {
    public:  { color: T.success, bg: T.successBg },
    friends: { color: T.primary, bg: "#edf2ff"   },
    private: { color: T.muted,   bg: T.border     },
  };
  const visOptions = [
    { value: "all",     label: "All"     },
    { value: "public",  label: "Public"  },
    { value: "friends", label: "Batchmates" },
    { value: "private", label: "Private" },
  ];
  const visibilityChoices = visOptions.filter(option => option.value !== "all");

  const handleVisibilityChange = async (photo, visibility) => {
    setActLoading(true);
    try {
      const { data } = await api.patch(`/admin/media/photos/${photo.id}/visibility`, { visibility });
      const nextVisibility = data?.data?.visibility ?? visibility;
      const applyVisibility = item => ({ ...item, visibility: nextVisibility });

      setPhotos(current => {
        if (visFilter !== "all" && nextVisibility !== visFilter) {
          return current.filter(item => item.id !== photo.id);
        }
        return current.map(item => item.id === photo.id ? applyVisibility(item) : item);
      });
      setLightbox(current => current?.id === photo.id ? applyVisibility(current) : current);
      toast(`Photo visibility set to ${visibilityLabel(nextVisibility)}.`);
    } catch {
      toast("Visibility update failed.", "error");
    } finally {
      setActLoading(false);
    }
  };

  const visibilityMenuActions = photo => visibilityChoices
    .filter(option => option.value !== photo.visibility)
    .map(option => ({
      label: `Set ${option.label}`,
      onClick: () => handleVisibilityChange(photo, option.value),
    }));

  return (
    <>
      {/* Slide-out panel */}
      <div
        style={{ position: "fixed", inset: 0, background: "rgba(15,23,41,.6)", zIndex: 1300, display: "flex", alignItems: "stretch", justifyContent: "flex-end" }}
        onClick={onClose}
      >
        <div
          style={{ background: T.surface, width: "min(860px, 100vw)", height: "100%", overflowY: "auto", animation: "slideIn .22s ease", display: "flex", flexDirection: "column" }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{ padding: "20px 24px", borderBottom: `1px solid ${T.border}`, display: "flex", gap: 14, alignItems: "flex-start", position: "sticky", top: 0, background: T.surface, zIndex: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 900, fontSize: "1.15rem", color: T.text }}>🗂 {album.title}</div>
              <div style={{ fontSize: "0.8rem", color: T.muted, marginTop: 4, display: "flex", gap: 10, flexWrap: "wrap" }}>
                {album.type && <span style={{ background: T.bg, padding: "2px 8px", borderRadius: 20, fontWeight: 600 }}>{album.type}</span>}
                {album.category && <span style={{ background: T.bg, padding: "2px 8px", borderRadius: 20, fontWeight: 600 }}>{album.category}</span>}
                {album.event_date && <span>📅 {album.event_date}</span>}
                <span>· {photos.length} photo{photos.length !== 1 ? "s" : ""} loaded</span>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{ background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer", color: T.muted, lineHeight: 1, padding: 4 }}
            >×</button>
          </div>

          {/* Filter bar */}
          <div style={{ padding: "12px 24px", borderBottom: `1px solid ${T.border}`, background: T.bg }}>
            <FilterPills options={visOptions} value={visFilter} onChange={v => { setVisFilter(v); setPage(1); }} />
          </div>

          {/* Photo grid */}
          <div style={{ padding: "20px 24px", flex: 1 }}>
            {loading ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14 }}>
                {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} w="100%" h={180} radius={12} />)}
              </div>
            ) : photos.length === 0 ? (
              <Empty
                icon="📭"
                title="No photos in this album"
                subtitle={visFilter !== "all" ? "Try changing the visibility filter." : "Upload photos to this album to see them here."}
              />
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14 }}>
                {photos.map((photo, idx) => {
                  const imgSrc = photo.url ?? photo.file_path;
                  const vc     = visColor[photo.visibility] ?? { color: T.muted, bg: T.border };

                  return (
                    <div
                      key={photo.id}
                      style={{ borderRadius: 14, overflow: "hidden", border: `1.5px solid ${T.border}`, background: T.surface, boxShadow: T.shadow, transition: "transform .15s", position: "relative" }}
                      onMouseEnter={e => e.currentTarget.style.transform = "scale(1.02)"}
                      onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
                    >
                      {/* Thumbnail */}
                      <div
                        style={{ height: 160, background: "#0d1528", cursor: "pointer", overflow: "hidden", position: "relative" }}
                        onClick={() => openLightbox(photo, idx)}
                      >
                        {imgSrc
                          ? <MediaPreview item={photo} src={imgSrc} alt={photo.caption} />
                          : <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#ffffff33", fontSize: "2rem" }}>🖼</div>
                        }
                        {/* Visibility badge */}
                        <div style={{ position: "absolute", top: 6, left: 6 }}>
                          <Badge label={visibilityLabel(photo.visibility)} color={vc.color} bg={vc.bg} />
                        </div>
                        {/* Status badge (only if not public/approved) */}
                        {photo.status && photo.status !== "approved" && (
                          <div style={{ position: "absolute", top: 6, right: 6 }}>
                            {statusBadge(photo.status)}
                          </div>
                        )}
                        {/* Hover overlay */}
                        <div
                          style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0)", display: "flex", alignItems: "center", justifyContent: "center", transition: "background .15s" }}
                          onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,0,0,.35)"; const s = e.currentTarget.querySelector("span"); if (s) s.style.opacity = "1"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,0,0,0)";   const s = e.currentTarget.querySelector("span"); if (s) s.style.opacity = "0"; }}
                        >
                          <span style={{ color: "#fff", fontSize: "0.75rem", fontWeight: 700, background: "rgba(255,255,255,.15)", padding: "5px 12px", borderRadius: 20, opacity: "0", transition: "opacity .15s", backdropFilter: "blur(4px)" }}>
                            👁 View
                          </span>
                        </div>
                      </div>

                      {/* Caption + delete row */}
                      <div style={{ padding: "8px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        {photo.caption ? (
                          <div style={{ fontSize: "0.75rem", color: T.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                            {photo.caption}
                          </div>
                        ) : <div style={{ flex: 1 }} />}
                        <OverflowMenu
                          actions={[
                            ...visibilityMenuActions(photo),
                            { label: "Delete photo", destructive: true, onClick: () => setDeleteTarget(photo) },
                          ]}
                        />
                      </div>

                      {/* Uploader info */}
                      {photo.uploader && (
                        <div style={{ padding: "0 10px 8px", fontSize: "0.7rem", color: T.muted }}>
                          by {photo.uploader}
                          {photo.created_at_human ? ` · ${photo.created_at_human}` : ""}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            <Pagination meta={meta} onPage={p => setPage(p)} />
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(5,10,25,.94)", zIndex: 2200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}
          onClick={() => setLightbox(null)}
        >
          <div
            style={{ position: "relative", maxWidth: "90vw", maxHeight: "88vh", display: "flex", flexDirection: "column", alignItems: "center" }}
            onClick={e => e.stopPropagation()}
          >
            {photos.length > 1 && (
              <>
                <button onClick={goPrev} style={{ position: "absolute", left: -56, top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,.12)", border: "none", color: "#fff", fontSize: "1.6rem", width: 44, height: 44, borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>‹</button>
                <button onClick={goNext} style={{ position: "absolute", right: -56, top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,.12)", border: "none", color: "#fff", fontSize: "1.6rem", width: 44, height: 44, borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>›</button>
              </>
            )}
            {mediaKind(lightbox) === "video" ? (
              <video
                src={lightbox.url ?? lightbox.file_path}
                controls
                style={{ maxWidth: "88vw", maxHeight: "74vh", borderRadius: 16, objectFit: "contain", boxShadow: "0 8px 60px rgba(0,0,0,.7)", background: "#000" }}
              />
            ) : (
              <img
                src={lightbox.url ?? lightbox.file_path}
                alt={lightbox.caption}
                style={{ maxWidth: "88vw", maxHeight: "74vh", borderRadius: 16, objectFit: "contain", boxShadow: "0 8px 60px rgba(0,0,0,.7)" }}
              />
            )}
            {/* Caption bar */}
            <div style={{ marginTop: 14, background: "rgba(255,255,255,.07)", backdropFilter: "blur(8px)", borderRadius: 14, padding: "12px 20px", display: "flex", alignItems: "center", gap: 16, minWidth: 300, maxWidth: 600, justifyContent: "space-between" }}>
              <div>
                <div style={{ color: "#fff", fontWeight: 700, fontSize: "0.88rem" }}>{lightbox.caption || "No caption"}</div>
                <div style={{ color: "rgba(255,255,255,.45)", fontSize: "0.74rem", marginTop: 2 }}>
                  {lightbox.uploader} {lightbox.created_at_human ? `· ${lightbox.created_at_human}` : ""}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                {statusBadge(lightbox.status ?? "approved")}
                <OverflowMenu
                  actions={[
                    ...visibilityMenuActions(lightbox),
                    { label: "Delete photo", destructive: true, onClick: () => { setDeleteTarget(lightbox); setLightbox(null); } },
                  ]}
                />
              </div>
            </div>
            {photos.length > 1 && (
              <div style={{ marginTop: 10, color: "rgba(255,255,255,.35)", fontSize: "0.78rem" }}>{lightboxIdx + 1} / {photos.length}</div>
            )}
          </div>
          <button onClick={() => setLightbox(null)} style={{ position: "absolute", top: 20, right: 24, background: "rgba(255,255,255,.1)", border: "none", color: "#fff", fontSize: "1.4rem", width: 38, height: 38, borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
        </div>
      )}

      {/* Confirm delete */}
      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Photo"
        message={`Permanently delete "${deleteTarget?.caption || "this photo"}"? This cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={actLoading}
      />
    </>
  );
}


// MEDIA LIBRARY MODE


function StatCard({ icon, label, value, color = T.primary }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: "18px 20px", boxShadow: T.shadow, display: "flex", alignItems: "center", gap: 14 }}>
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100" style={{ color }}>
        <Icon name={icon} className="h-6 w-6" />
      </div>
      <div>
        <div style={{ fontSize: "0.75rem", fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".05em" }}>{label}</div>
        <div style={{ fontSize: "1.5rem", fontWeight: 900, color }}>{value ?? "—"}</div>
      </div>
    </div>
  );
}

// Albums Tab
function LibraryAlbumsTab({ toast }) {
  const [items,        setItems]        = useState([]);
  const [meta,         setMeta]         = useState(null);
  const [page,         setPage]         = useState(1);
  const [loading,      setLoading]      = useState(true);
  const [actLoading,   setActLoading]   = useState(false);
  const [typeFilter,   setTypeFilter]   = useState("all");
  const [albumModal,   setAlbumModal]   = useState(false);
  const [editTarget,   setEditTarget]   = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  // drill-down state
  const [openAlbum,    setOpenAlbum]    = useState(null);

  const load = useCallback(async (p = 1, type = typeFilter) => {
    setLoading(true);
    try {
      const params = { page: p, per_page: 18 };
      if (type !== "all") params.type = type;
      const res = await api.get("/admin/media/albums", { params });
      setItems(res.data.data ?? []); setMeta(res.data.meta ?? null);
    } catch { toast("Failed to load albums.", "error"); }
    finally { setLoading(false); }
  }, [typeFilter]);

  useEffect(() => { load(page, typeFilter); }, [page, typeFilter]);

  const handleSave = async form => {
    setActLoading(true);
    try {
      if (editTarget) { await api.put(`/admin/media/albums/${editTarget.id}`, form); toast("Album updated."); }
      else            { await api.post("/admin/media/albums", form);              toast("Album created."); }
      setAlbumModal(false); setEditTarget(null); load(page, typeFilter);
    } catch { toast("Save failed.", "error"); }
    finally { setActLoading(false); }
  };

  const handleDelete = async () => {
    setActLoading(true);
    try {
      await api.delete(`/admin/media/albums/${deleteTarget.id}`);
      toast("Album deleted."); setDeleteTarget(null); load(page, typeFilter);
    } catch { toast("Delete failed.", "error"); }
    finally { setActLoading(false); }
  };

  const typeColor   = { general: { color: T.primary, bg: "#edf2ff" }, graduation: { color: T.success, bg: T.successBg }, profile: { color: T.warning, bg: T.warningBg } };
  const typeOptions = [{ value: "all", label: "All" }, { value: "general", label: "General" }, { value: "graduation", label: "Graduation" }, { value: "profile", label: "Profile" }];

  return (
    <>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 18, flexWrap: "wrap" }}>
        <FilterPills options={typeOptions} value={typeFilter} onChange={v => { setTypeFilter(v); setPage(1); }} />
        <div style={{ flex: 1 }} />
        <button onClick={() => { setEditTarget(null); setAlbumModal(true); }}
          style={{ padding: "8px 18px", borderRadius: 10, border: "none", background: T.primary, color: "#fff", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer", fontFamily: "inherit" }}>
          + New Album
        </button>
      </div>

      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} style={{ background: T.surface, borderRadius: 16, overflow: "hidden", border: `1px solid ${T.border}` }}>
              <Skeleton w="100%" h={140} radius={0} />
              <div style={{ padding: 14 }}><Skeleton w="60%" h={13} style={{ marginBottom: 8 }} /><Skeleton w="40%" h={11} /></div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? <Empty icon="🗂" title="No albums found" subtitle="Create one to get started." /> : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
          {items.map(album => {
            const tc = typeColor[album.type] ?? { color: T.muted, bg: T.border };
            return (
              // whole card is clickable opens drill-down panel
              <div
                key={album.id}
                onClick={() => setOpenAlbum(album)}
                style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden", boxShadow: T.shadow, cursor: "pointer", transition: "transform .15s, box-shadow .15s" }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = T.shadowMd; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)";    e.currentTarget.style.boxShadow = T.shadow;   }}
              >
                <div style={{ height: 140, background: "#0f1729", position: "relative", overflow: "hidden" }}>
                  {album.cover_photo_url
                    ? <MediaPreview item={{ resource_type: album.cover_resource_type ?? "image" }} src={album.cover_photo_url} alt={album.title} />
                    : <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: "2.5rem", color: "#ffffff33" }}>🖼</div>
                  }
                  <div style={{ position: "absolute", top: 8, right: 8 }}><Badge label={album.type} color={tc.color} bg={tc.bg} /></div>
                  {/* "Open" overlay hint */}
                  <div style={{ position: "absolute", bottom: 8, left: 8, background: "rgba(0,0,0,.55)", color: "#fff", fontSize: "0.7rem", fontWeight: 700, padding: "3px 8px", borderRadius: 20, backdropFilter: "blur(4px)" }}>
                    {album.photo_count ?? 0} photo{(album.photo_count ?? 0) !== 1 ? "s" : ""} · click to browse
                  </div>
                </div>
                <div style={{ padding: "12px 14px" }}>
                  <div style={{ fontWeight: 700, fontSize: "0.9rem", color: T.text, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{album.title}</div>
                  {(album.category || album.event_date) && (
                    <div style={{ fontSize: "0.75rem", color: T.muted, marginBottom: 10 }}>
                      {[album.category, album.event_date].filter(Boolean).join(" · ")}
                    </div>
                  )}
                  {/* Stop propagation so Edit/Delete don't open the panel */}
                  <div style={{ display: "flex", gap: 6 }} onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => { setEditTarget(album); setAlbumModal(true); }}
                      style={{ flex: 1, padding: "6px", borderRadius: 8, border: `1px solid ${T.border}`, background: "none", color: T.muted, fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                    >✏ Edit</button>
                    <OverflowMenu
                      actions={[
                        { label: "Delete album", destructive: true, onClick: () => setDeleteTarget(album) },
                      ]}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Pagination meta={meta} onPage={p => setPage(p)} />

      <AlbumFormModal
        open={albumModal}
        album={editTarget}
        onSave={handleSave}
        onCancel={() => { setAlbumModal(false); setEditTarget(null); }}
        loading={actLoading}
      />
      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Album"
        message={`Delete "${deleteTarget?.title}"? This will also remove all photos inside it.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={actLoading}
      />

      {/* Album drill-down panel */}
      <LibraryAlbumDrillPanel
        album={openAlbum}
        onClose={() => setOpenAlbum(null)}
        toast={toast}
      />
    </>
  );
}

// Photos Tab (Library)
function LibraryPhotosTab({ toast }) {
  const [items,        setItems]        = useState([]);
  const [meta,         setMeta]         = useState(null);
  const [page,         setPage]         = useState(1);
  const [loading,      setLoading]      = useState(true);
  const [actLoading,   setActLoading]   = useState(false);
  const [visFilter,    setVisFilter]    = useState("all");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [preview,      setPreview]      = useState(null);

  const load = useCallback(async (p = 1, vis = visFilter) => {
    setLoading(true);
    try {
      const params = { page: p, per_page: 24 };
      if (vis !== "all") params.visibility = vis;
      const res = await api.get("/admin/media/photos", { params });
      setItems(res.data.data ?? []); setMeta(res.data.meta ?? null);
    } catch { toast("Failed to load photos.", "error"); }
    finally { setLoading(false); }
  }, [visFilter]);

  useEffect(() => { load(page, visFilter); }, [page, visFilter]);

  const handleDelete = async () => {
    setActLoading(true);
    try { await api.delete(`/admin/media/photos/${deleteTarget.id}`); toast("Photo deleted."); setDeleteTarget(null); load(page, visFilter); }
    catch { toast("Delete failed.", "error"); }
    finally { setActLoading(false); }
  };

  const visColor   = { public: { color: T.success, bg: T.successBg }, friends: { color: T.primary, bg: "#edf2ff" }, private: { color: T.muted, bg: T.border } };
  const visOptions = [{ value: "all", label: "All" }, { value: "public", label: "Public" }, { value: "friends", label: "Batchmates" }, { value: "private", label: "Private" }];
  const visibilityChoices = visOptions.filter(option => option.value !== "all");

  const handleVisibilityChange = async (photo, visibility) => {
    setActLoading(true);
    try {
      const { data } = await api.patch(`/admin/media/photos/${photo.id}/visibility`, { visibility });
      const nextVisibility = data?.data?.visibility ?? visibility;
      const applyVisibility = item => ({ ...item, visibility: nextVisibility });

      setItems(current => {
        if (visFilter !== "all" && nextVisibility !== visFilter) {
          return current.filter(item => item.id !== photo.id);
        }
        return current.map(item => item.id === photo.id ? applyVisibility(item) : item);
      });
      setPreview(current => current?.id === photo.id ? applyVisibility(current) : current);
      toast(`Photo visibility set to ${visibilityLabel(nextVisibility)}.`);
    } catch {
      toast("Visibility update failed.", "error");
    } finally {
      setActLoading(false);
    }
  };

  const visibilityMenuActions = photo => visibilityChoices
    .filter(option => option.value !== photo.visibility)
    .map(option => ({
      label: `Set ${option.label}`,
      onClick: () => handleVisibilityChange(photo, option.value),
    }));

  return (
    <>
      <div style={{ marginBottom: 18 }}><FilterPills options={visOptions} value={visFilter} onChange={v => { setVisFilter(v); setPage(1); }} /></div>

      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
          {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} w="100%" h={180} radius={12} />)}
        </div>
      ) : items.length === 0 ? <Empty icon="📷" title="No photos found" subtitle="Photos will appear here." /> : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
          {items.map(photo => {
            const vc = visColor[photo.visibility] ?? { color: T.muted, bg: T.border };
            return (
              <div key={photo.id} style={{ position: "relative", borderRadius: 12, overflow: "hidden", background: "#0f1729", border: `1px solid ${T.border}`, cursor: "pointer" }} onClick={() => setPreview(photo)}>
                <img src={photo.file_path} alt={photo.caption} style={{ width: "100%", height: 180, objectFit: "cover", display: "block" }} onError={e => e.target.style.display = "none"} />
                <div style={{ position: "absolute", top: 6, left: 6 }}><Badge label={visibilityLabel(photo.visibility)} color={vc.color} bg={vc.bg} /></div>
                <div style={{ position: "absolute", top: 6, right: 6 }}>
                  <OverflowMenu
                    actions={[
                      ...visibilityMenuActions(photo),
                      { label: "Delete photo", destructive: true, onClick: () => setDeleteTarget(photo) },
                    ]}
                  />
                </div>
                {photo.caption && (
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(transparent, rgba(0,0,0,.7))", padding: "16px 8px 6px", fontSize: "0.72rem", color: "#fff", fontWeight: 600 }}>{photo.caption}</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Pagination meta={meta} onPage={p => setPage(p)} />

      {preview && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.85)", zIndex: 1800, display: "grid", placeItems: "center", padding: 20 }} onClick={() => setPreview(null)}>
          <div style={{ maxWidth: 700, width: "100%", animation: "fadeIn .18s ease" }} onClick={e => e.stopPropagation()}>
            <img src={preview.file_path} alt={preview.caption} style={{ width: "100%", borderRadius: 16, maxHeight: "75vh", objectFit: "contain" }} />
            <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ color: "#fff", fontSize: "0.88rem" }}>{preview.caption ?? "No caption"} · <span style={{ color: "#ffffff88" }}>{preview.uploader}</span></div>
              <OverflowMenu
                actions={[
                  ...visibilityMenuActions(preview),
                  { label: "Delete photo", destructive: true, onClick: () => { setPreview(null); setDeleteTarget(preview); } },
                ]}
              />
            </div>
          </div>
        </div>
      )}

      <ConfirmModal open={!!deleteTarget} title="Delete Photo" message="Permanently delete this photo? This cannot be undone." onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} loading={actLoading} />
    </>
  );
}

// Videos Tab (Library)
function LibraryVideosTab({ toast }) {
  const [items,        setItems]        = useState([]);
  const [meta,         setMeta]         = useState(null);
  const [page,         setPage]         = useState(1);
  const [loading,      setLoading]      = useState(true);
  const [actLoading,   setActLoading]   = useState(false);
  const [sourceFilter, setSourceFilter] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [preview,      setPreview]      = useState(null);

  const load = useCallback(async (p = 1, source = sourceFilter) => {
    setLoading(true);
    try {
      const params = { page: p, per_page: 18 };
      if (source !== "all") params.source = source;
      const res = await api.get("/admin/media/videos", { params });
      setItems(res.data.data ?? []); setMeta(res.data.meta ?? null);
    } catch { toast("Failed to load videos.", "error"); }
    finally { setLoading(false); }
  }, [sourceFilter]);

  useEffect(() => { load(page, sourceFilter); }, [page, sourceFilter]);

  const handleDelete = async () => {
    setActLoading(true);
    try {
      await api.delete(`/admin/media/videos/${deleteTarget.id}`, { params: { source: deleteTarget.source } });
      toast("Video deleted.");
      setDeleteTarget(null);
      load(page, sourceFilter);
    }
    catch { toast("Delete failed.", "error"); }
    finally { setActLoading(false); }
  };

  const sourceOptions = [{ value: "all", label: "All" }, { value: "graduation", label: "🎓 Graduation" }, { value: "post", label: "📱 Posts" }];

  return (
    <>
      <div style={{ marginBottom: 18 }}><FilterPills options={sourceOptions} value={sourceFilter} onChange={v => { setSourceFilter(v); setPage(1); }} /></div>

      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} style={{ background: T.surface, borderRadius: 16, overflow: "hidden", border: `1px solid ${T.border}` }}>
              <Skeleton w="100%" h={140} radius={0} />
              <div style={{ padding: 14 }}><Skeleton w="60%" h={13} style={{ marginBottom: 8 }} /><Skeleton w="40%" h={11} /></div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? <Empty icon="🎬" title="No videos found" subtitle="Videos will appear here." /> : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
          {items.map(video => (
            <div key={video.id} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden", boxShadow: T.shadow }}>
              <div onClick={() => setPreview(video)} style={{ height: 140, background: "#0f1729", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", position: "relative" }}>
                <div style={{ textAlign: "center", color: "#ffffff66" }}><div style={{ fontSize: "2.5rem" }}>▶</div><div style={{ fontSize: "0.75rem", marginTop: 4 }}>Video</div></div>
                <div style={{ position: "absolute", top: 8, left: 8 }}><Badge label={video.source === "graduation" ? "🎓 Graduation" : "📱 Post"} color={video.source === "graduation" ? T.success : T.primary} bg={video.source === "graduation" ? T.successBg : "#edf2ff"} /></div>
                {video.bytes && <div style={{ position: "absolute", bottom: 6, right: 6, background: "rgba(0,0,0,.6)", color: "#fff", fontSize: "0.7rem", fontWeight: 600, padding: "2px 7px", borderRadius: 6 }}>{(video.bytes / (1024 * 1024)).toFixed(1)} MB</div>}
              </div>
              <div style={{ padding: "12px 14px" }}>
                <div style={{ fontSize: "0.82rem", fontWeight: 700, color: T.text, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{video.filename ?? "Untitled"}</div>
                <div style={{ fontSize: "0.74rem", color: T.muted, marginBottom: 10 }}>{video.uploader ?? "Unknown"}{video.width && video.height ? ` · ${video.width}×${video.height}` : ""}</div>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <OverflowMenu
                    actions={[
                      { label: "Delete video", destructive: true, onClick: () => setDeleteTarget(video) },
                    ]}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Pagination meta={meta} onPage={p => setPage(p)} />

      {preview && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.85)", zIndex: 1800, display: "grid", placeItems: "center", padding: 20 }} onClick={() => setPreview(null)}>
          <div style={{ maxWidth: 700, width: "100%", animation: "fadeIn .18s ease" }} onClick={e => e.stopPropagation()}>
            <video src={preview.file_path} controls style={{ width: "100%", borderRadius: 16, maxHeight: "70vh" }} />
            <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ color: "#fff", fontSize: "0.88rem", fontWeight: 600 }}>{preview.filename ?? "Untitled"}</div>
                <div style={{ color: "#ffffff88", fontSize: "0.78rem", marginTop: 2 }}>{preview.uploader ?? "Unknown"} · {preview.source === "graduation" ? "🎓 Graduation" : "📱 Post"}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <OverflowMenu
                  actions={[
                    { label: "Delete video", destructive: true, onClick: () => { setPreview(null); setDeleteTarget(preview); } },
                  ]}
                />
                <button onClick={() => setPreview(null)}
                  style={{ padding: "7px 16px", borderRadius: 10, border: "none", background: "rgba(255,255,255,.15)", color: "#fff", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer", fontFamily: "inherit" }}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal open={!!deleteTarget} title="Delete Video" message={`Permanently delete "${deleteTarget?.filename ?? "this video"}"?`} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} loading={actLoading} />
    </>
  );
}

// Media Library Mode
const LIB_TABS = [
  { key: "albums", label: "Albums"      },
  { key: "photos", label: "Photos"      },
  { key: "videos", label: "Videos"      },
];

function MediaLibraryMode({ toast }) {
  const [activeTab, setActiveTab] = useState("albums");
  const [stats,     setStats]     = useState(null);

  useEffect(() => {
    api.get("/admin/media/stats").then(r => setStats(r.data)).catch(() => {});
  }, []);

  return (
    <div>
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 14, marginBottom: 24 }}>
          <StatCard icon="albums" label="Albums"      value={stats.albums}      />
          <StatCard icon="photos" label="Photos"      value={stats.photos}      />
          <StatCard icon="videos" label="Videos"      value={stats.videos}      />
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {LIB_TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            style={{ padding: "9px 18px", borderRadius: 12, border: `1.5px solid ${activeTab === t.key ? T.primary : T.border}`, background: activeTab === t.key ? T.primary : T.surface, color: activeTab === t.key ? "#fff" : T.text, fontWeight: 700, fontSize: "0.86rem", cursor: "pointer", fontFamily: "inherit", transition: "all .15s" }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 20, padding: "22px 20px", boxShadow: T.shadow }}>
        {activeTab === "albums" && <LibraryAlbumsTab     toast={toast} />}
        {activeTab === "photos" && <LibraryPhotosTab     toast={toast} />}
        {activeTab === "videos" && <LibraryVideosTab     toast={toast} />}
      </div>
    </div>
  );
}


// ROOT PAGE


const MODES = [
  { key: "moderation", icon: "moderation", label: "Moderation",   desc: "Review and approve user-uploaded content" },
  { key: "library",    icon: "library",    label: "Media Library", desc: "Browse, manage, and delete all media"    },
];

export default function MediaModerationPage() {
  const [mode, setMode] = useState("moderation");
  const { toasts, push: toast } = useToast();

  return (
    <>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes fadeIn  { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideIn { from{transform:translateX(100%)} to{transform:translateX(0)} }
        * { box-sizing: border-box; }
      `}</style>

      <div className="min-h-screen bg-slate-50 px-6 py-7 animate-[fadeIn_.3s_ease]">
        <div className="mb-7">
          <h1 className="mb-4 text-3xl font-black tracking-tight text-slate-800">
            {mode === "moderation" ? "Content Moderation" : "Media Library"}
          </h1>

          <div className="inline-flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            {MODES.map(m => (
              <button key={m.key} onClick={() => setMode(m.key)}
                className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold transition ${
                  mode === m.key
                    ? "bg-indigo-600 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Icon name={m.icon} className="h-4 w-4" />
                <span>{m.label}</span>
              </button>
            ))}
          </div>

          <p className="mt-2.5 text-sm text-slate-500">
            {MODES.find(m => m.key === mode)?.desc}
          </p>
        </div>

        {mode === "moderation" && <ModerationMode toast={toast} />}
        {mode === "library"    && <MediaLibraryMode toast={toast} />}
      </div>

      <Toast toasts={toasts} />
    </>
  );
}
