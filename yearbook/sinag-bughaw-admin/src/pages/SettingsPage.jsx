/**
 * SettingsPage.jsx
 * NU Lipa / Sinag-Bughaw — Admin Panel
 *
 * API:
 *   GET    /api/admin/settings
 *   POST   /api/admin/settings
 *   DELETE /api/admin/settings/clear-audit-logs
 *   POST   /api/admin/settings/reset
 *   POST   /api/admin/settings/archive-batch
 */

import { useCallback, useEffect, useRef, useState } from "react";
import api from "../services/api";

const T = {
  bg: "#f0f4ff",
  surface: "#ffffff",
  border: "#e2e8f5",
  text: "#1a2540",
  muted: "#5b6784",
  primary: "#4254c5",
  success: "#16a34a",
  successBg: "#dcfce7",
  danger: "#ef4444",
  dangerBg: "#fee2e2",
  shadow: "0 2px 12px rgba(66,84,197,.07)",
  shadowMd: "0 4px 24px rgba(66,84,197,.13)",
};

/** Must mirror SettingsController::DEFAULTS exactly (string values). */
const DEFAULTS = {
  school_name: "National University - Lipa",
  yearbook_name: "Sinag-Bughaw Digital Yearbook",
  contact_email: "",
  maintenance_mode: "0",
  academic_year: "2025-2026",
  graduation_batch: "",
  graduation_date: "",
  graduation_theme: "",
  publish_yearbook: "0",
  max_upload_size_mb: "10",
  allowed_file_types: "jpg,jpeg,png,mp4,mp3,pdf",
  allow_student_posts: "1",
  allow_comments: "1",
  allow_reactions: "1",
  enable_premium_subscription: "1",
  premium_storage_limit_mb: "5120",
  premium_badge_display: "1",
  enable_flipbook_viewer: "1",
  enable_yearbook_pdf_download: "1",
  enable_student_directory_search: "1",
  session_timeout_minutes: "120",
  max_login_attempts: "5",
  auto_backup_database: "0",
  audit_logs_enabled: "1",
};

const Sk = ({ w = "100%", h = 14, r = 6, style = {} }) => (
  <div
    style={{
      width: w,
      height: h,
      borderRadius: r,
      background: "linear-gradient(90deg,#e8edf8 25%,#f4f6fc 50%,#e8edf8 75%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.4s infinite linear",
      ...style,
    }}
  />
);

function useToast() {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((message, type = "success") => {
    const id = Date.now() + Math.random();
    setToasts((p) => [...p, { id, message, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3500);
  }, []);
  return { toasts, push };
}

function Toast({ toasts }) {
  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            padding: "12px 18px",
            borderRadius: 12,
            fontWeight: 600,
            fontSize: "0.88rem",
            background: t.type === "error" ? T.dangerBg : T.successBg,
            color: t.type === "error" ? T.danger : T.success,
            border: `1px solid ${t.type === "error" ? "#fca5a5" : "#86efac"}`,
            boxShadow: T.shadowMd,
            animation: "fadeIn .2s ease",
          }}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}

function ConfirmModal({ open, title, message, confirmLabel, danger, loading, onConfirm, onCancel }) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        background: "rgba(15,23,42,.45)",
        display: "grid",
        placeItems: "center",
        padding: 20,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          background: T.surface,
          borderRadius: 18,
          border: `1px solid ${T.border}`,
          boxShadow: T.shadowMd,
          padding: "22px 24px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-modal-title" style={{ margin: "0 0 8px", fontSize: "1.05rem", fontWeight: 800, color: T.text }}>
          {title}
        </h2>
        <p style={{ margin: "0 0 20px", fontSize: "0.88rem", color: T.muted, lineHeight: 1.55 }}>{message}</p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            style={{
              padding: "9px 16px",
              borderRadius: 10,
              border: `1px solid ${T.border}`,
              background: T.surface,
              color: T.muted,
              fontWeight: 700,
              fontSize: "0.86rem",
              cursor: loading ? "not-allowed" : "pointer",
              fontFamily: "inherit",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            style={{
              padding: "9px 18px",
              borderRadius: 10,
              border: "none",
              background: danger ? T.danger : T.primary,
              color: "#fff",
              fontWeight: 700,
              fontSize: "0.86rem",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
              fontFamily: "inherit",
            }}
          >
            {loading ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function Toggle({ value, onChange, disabled, label }) {
  const handleKeyDown = (e) => {
    if (disabled) return;
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      onChange(!value);
    }
  };

  return (
    <div
      role="switch"
      aria-checked={value}
      aria-label={label}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={handleKeyDown}
      onClick={() => !disabled && onChange(!value)}
      style={{
        width: 44,
        height: 24,
        borderRadius: 999,
        background: value ? T.primary : "#d1d5db",
        cursor: disabled ? "not-allowed" : "pointer",
        position: "relative",
        transition: "background .2s",
        flexShrink: 0,
        outline: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 3,
          left: value ? 23 : 3,
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "#fff",
          boxShadow: "0 1px 4px rgba(0,0,0,.2)",
          transition: "left .2s",
        }}
      />
    </div>
  );
}

function SectionCard({ title, children }) {
  return (
    <div
      style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 20,
        boxShadow: T.shadow,
        overflow: "hidden",
        marginBottom: 22,
      }}
    >
      <div
        style={{
          padding: "18px 24px 16px",
          borderBottom: `1px solid ${T.border}`,
        }}
      >
        <span style={{ fontWeight: 800, fontSize: "1rem", color: T.text }}>{title}</span>
      </div>
      <div style={{ padding: "20px 24px" }}>{children}</div>
    </div>
  );
}

function SettingRow({ label, description, children, last }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 20,
        paddingBottom: last ? 0 : 18,
        marginBottom: last ? 0 : 18,
        borderBottom: last ? "none" : `1px solid ${T.border}`,
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: "0.9rem", fontWeight: 700, color: T.text, marginBottom: 3 }}>{label}</div>
        {description && (
          <div style={{ fontSize: "0.8rem", color: T.muted, lineHeight: 1.5 }}>{description}</div>
        )}
      </div>
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>{children}</div>
    </div>
  );
}

const inputStyle = {
  padding: "8px 12px",
  borderRadius: 9,
  border: `1px solid ${T.border}`,
  fontSize: "0.86rem",
  color: T.text,
  background: T.bg,
  fontFamily: "inherit",
  outline: "none",
  width: 220,
};

function extractError(err) {
  const errors = err.response?.data?.errors;
  if (errors && typeof errors === "object") {
    return Object.values(errors).flat().join(" ");
  }
  return err.response?.data?.message ?? err.message ?? "Request failed.";
}

export default function SettingsPage() {
  const [settings, setSettings] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState(null);
  const { toasts, push: toast } = useToast();
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;

    api
      .get("/admin/settings")
      .then((r) => {
        if (!isMounted.current) return;
        setSettings({ ...DEFAULTS, ...(r.data?.data ?? {}) });
      })
      .catch(() => {
        if (!isMounted.current) return;
        toast("Could not load settings. Showing defaults.", "error");
        setSettings(DEFAULTS);
      })
      .finally(() => {
        if (isMounted.current) setLoading(false);
      });

    return () => {
      isMounted.current = false;
    };
  }, [toast]);

  const set = (key, val) => setSettings((p) => ({ ...p, [key]: String(val) }));
  const bool = (key) => settings[key] === "1";
  const toggleSetting = async (key) => {
    const next = bool(key) ? "0" : "1";
    set(key, next);

    const savesImmediately = ["allow_student_posts", "allow_comments", "allow_reactions"].includes(key);
    if (!savesImmediately) return;

    try {
      await api.post("/admin/settings", { [key]: next });
      toast(next === "1" ? "Turned on and saved." : "Turned off and saved.");
    } catch (err) {
      set(key, next === "1" ? "0" : "1");
      toast(extractError(err), "error");
    }
  };

  const save = async (keys) => {
    setSaving(true);
    try {
      const payload = Object.fromEntries(keys.map((k) => [k, settings[k] ?? DEFAULTS[k] ?? ""]));
      await api.post("/admin/settings", payload);
      toast("Settings saved successfully.");
    } catch (err) {
      toast(extractError(err), "error");
    } finally {
      setSaving(false);
    }
  };

  const SaveBtn = ({ keys, label = "Save Changes" }) => (
    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
      <button
        type="button"
        onClick={() => save(keys)}
        disabled={saving || loading}
        style={{
          padding: "9px 22px",
          borderRadius: 10,
          border: "none",
          background: T.primary,
          color: "#fff",
          fontWeight: 700,
          fontSize: "0.88rem",
          cursor: saving || loading ? "not-allowed" : "pointer",
          opacity: saving || loading ? 0.7 : 1,
          fontFamily: "inherit",
        }}
      >
        {saving ? "Saving…" : label}
      </button>
    </div>
  );

  const runDangerAction = async () => {
    if (!modal) return;
    setSaving(true);
    try {
      if (modal.type === "clear-audit") {
        await api.delete("/admin/settings/clear-audit-logs");
        toast("Audit logs cleared.");
      } else if (modal.type === "reset") {
        const res = await api.post("/admin/settings/reset");
        setSettings({ ...DEFAULTS, ...(res.data?.data ?? {}) });
        toast("Settings reset to defaults.");
      } else if (modal.type === "archive") {
        await api.post("/admin/settings", {
          graduation_batch: settings.graduation_batch ?? "",
        });
        await api.post("/admin/settings/archive-batch");
        const res = await api.get("/admin/settings");
        setSettings({ ...DEFAULTS, ...(res.data?.data ?? {}) });
        toast("Batch archived. Graduation settings cleared.");
      }
      setModal(null);
    } catch (err) {
      toast(extractError(err), "error");
    } finally {
      setSaving(false);
    }
  };

  const dangerBtn = {
    padding: "8px 18px",
    borderRadius: 10,
    fontWeight: 700,
    fontSize: "0.86rem",
    cursor: saving ? "not-allowed" : "pointer",
    fontFamily: "inherit",
    whiteSpace: "nowrap",
  };

  return (
    <>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes fadeIn  { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        * { box-sizing: border-box; }
      `}</style>

      <div style={{ padding: "28px 24px 60px", background: T.bg, minHeight: "100vh", animation: "fadeIn .3s ease" }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: "1.55rem", fontWeight: 900, color: T.text, margin: 0 }}>Settings</h1>
          <p style={{ color: T.muted, fontSize: "0.9rem", margin: "6px 0 0" }}>
            Configure system-wide settings for the Sinag-Bughaw platform.
          </p>
        </div>

        {/* General */}
        <SectionCard title="General">
          {loading ? (
            <>
              <Sk h={14} style={{ marginBottom: 14 }} />
              <Sk w="70%" h={14} style={{ marginBottom: 14 }} />
              <Sk w="50%" h={14} />
            </>
          ) : (
            <>
              <SettingRow label="School Name" description="Official school name shown across the platform.">
                <input value={settings.school_name ?? ""} onChange={(e) => set("school_name", e.target.value)} style={inputStyle} />
              </SettingRow>
              <SettingRow label="Yearbook Name" description="Title of the digital yearbook product.">
                <input value={settings.yearbook_name ?? ""} onChange={(e) => set("yearbook_name", e.target.value)} style={inputStyle} />
              </SettingRow>
              <SettingRow label="Contact Email" description="Admin contact email for system alerts.">
                <input type="email" value={settings.contact_email ?? ""} onChange={(e) => set("contact_email", e.target.value)} style={inputStyle} />
              </SettingRow>
              <SettingRow label="Maintenance Mode" description="Temporarily disable access for all users except admins." last>
                <Toggle value={bool("maintenance_mode")} onChange={() => toggleSetting("maintenance_mode")} label="Maintenance mode" />
              </SettingRow>
              <SaveBtn keys={["school_name", "yearbook_name", "contact_email", "maintenance_mode"]} />
            </>
          )}
        </SectionCard>

        {/* Yearbook Generation */}
        <SectionCard title="Yearbook Generation">
          {loading ? (
            <Sk h={14} />
          ) : (
            <>
              <SettingRow label="Graduation Batch" description="Used by Archive Batch to choose which batch will become alumni.">
                <input value={settings.graduation_batch ?? ""} onChange={(e) => set("graduation_batch", e.target.value)} style={inputStyle} />
              </SettingRow>
              <SettingRow label="Archive Batch" description="Promotes this graduation batch to alumni and clears the yearbook generation fields." last>
                <button
                  type="button"
                  disabled={saving}
                  style={{ ...dangerBtn, border: "none", background: T.primary, color: "#fff" }}
                  onClick={() =>
                    setModal({
                      type: "archive",
                      title: "Archive graduation batch?",
                      message: `This will archive "${settings.graduation_batch || "(not set)"}", promote linked students to alumni, and reset graduation fields. This cannot be undone easily.`,
                      confirmLabel: "Archive Batch",
                      danger: true,
                    })
                  }
                >
                  Archive Batch
                </button>
              </SettingRow>
            </>
          )}
        </SectionCard>

        {/* Upload Settings */}
        <SectionCard title="Upload Settings">
          {loading ? (
            <Sk h={14} />
          ) : (
            <>
              <SettingRow label="Maximum Upload Size (MB)" description="Maximum file size allowed per upload.">
                <input
                  type="number"
                  value={settings.max_upload_size_mb ?? "10"}
                  onChange={(e) => set("max_upload_size_mb", e.target.value)}
                  style={{ ...inputStyle, width: 100 }}
                  min={1}
                  max={500}
                />
              </SettingRow>
              <SettingRow label="Allowed File Types" description="Comma-separated extensions (e.g. jpg,png,mp4)." last>
                <input value={settings.allowed_file_types ?? ""} onChange={(e) => set("allowed_file_types", e.target.value)} style={inputStyle} />
              </SettingRow>
              <SaveBtn keys={["max_upload_size_mb", "allowed_file_types"]} />
            </>
          )}
        </SectionCard>

        {/* Student Features */}
        <SectionCard title="Student Features">
          {loading ? (
            <Sk h={14} />
          ) : (
            <>
              <SettingRow label="Allow Student Posts" description="Students can publish posts to their profiles.">
                <Toggle value={bool("allow_student_posts")} onChange={() => toggleSetting("allow_student_posts")} label="Allow student posts" />
              </SettingRow>
              <SettingRow label="Allow Comments" description="Users can comment on posts and media.">
                <Toggle value={bool("allow_comments")} onChange={() => toggleSetting("allow_comments")} label="Allow comments" />
              </SettingRow>
              <SettingRow label="Allow Reactions" description="Users can react to posts and media." last>
                <Toggle value={bool("allow_reactions")} onChange={() => toggleSetting("allow_reactions")} label="Allow reactions" />
              </SettingRow>
              <SaveBtn keys={["allow_student_posts", "allow_comments", "allow_reactions"]} />
            </>
          )}
        </SectionCard>

        {/* Premium Features */}
        <SectionCard title="Premium Features">
          {loading ? (
            <Sk h={14} />
          ) : (
            <>
              <SettingRow label="Enable Premium Subscription" description="Allow premium plans and PayMongo billing.">
                <Toggle value={bool("enable_premium_subscription")} onChange={() => toggleSetting("enable_premium_subscription")} label="Enable premium subscription" />
              </SettingRow>
              <SettingRow label="Premium Storage Limit (MB)" description="Storage quota for premium subscribers.">
                <input
                  type="number"
                  value={settings.premium_storage_limit_mb ?? "5120"}
                  onChange={(e) => set("premium_storage_limit_mb", e.target.value)}
                  style={{ ...inputStyle, width: 120 }}
                  min={100}
                  max={102400}
                />
              </SettingRow>
              <SettingRow label="Premium Badge Display" description="Show premium badge on subscriber profiles." last>
                <Toggle value={bool("premium_badge_display")} onChange={() => toggleSetting("premium_badge_display")} label="Premium badge display" />
              </SettingRow>
              <SaveBtn keys={["enable_premium_subscription", "premium_storage_limit_mb", "premium_badge_display"]} />
            </>
          )}
        </SectionCard>

        {/* Yearbook Features */}
        <SectionCard title="Yearbook Features">
          {loading ? (
            <Sk h={14} />
          ) : (
            <>
              <SettingRow label="Enable Flipbook Viewer" description="Interactive page-flip yearbook viewer.">
                <Toggle value={bool("enable_flipbook_viewer")} onChange={() => toggleSetting("enable_flipbook_viewer")} label="Enable flipbook viewer" />
              </SettingRow>
              <SettingRow label="Enable Yearbook PDF Download" description="Allow downloading the yearbook as PDF.">
                <Toggle value={bool("enable_yearbook_pdf_download")} onChange={() => toggleSetting("enable_yearbook_pdf_download")} label="Enable PDF download" />
              </SettingRow>
              <SettingRow label="Enable Student Directory Search" description="Searchable student directory in the yearbook." last>
                <Toggle value={bool("enable_student_directory_search")} onChange={() => toggleSetting("enable_student_directory_search")} label="Enable directory search" />
              </SettingRow>
              <SaveBtn keys={["enable_flipbook_viewer", "enable_yearbook_pdf_download", "enable_student_directory_search"]} />
            </>
          )}
        </SectionCard>

        {/* Security */}
        <SectionCard title="Security">
          {loading ? (
            <Sk h={14} />
          ) : (
            <>
              <SettingRow label="Session Timeout (Minutes)" description="Inactive session length before automatic logout.">
                <input
                  type="number"
                  value={settings.session_timeout_minutes ?? "120"}
                  onChange={(e) => set("session_timeout_minutes", e.target.value)}
                  style={{ ...inputStyle, width: 100 }}
                  min={15}
                  max={1440}
                />
              </SettingRow>
              <SettingRow label="Maximum Login Attempts" description="Failed attempts before temporary lockout." last>
                <input
                  type="number"
                  value={settings.max_login_attempts ?? "5"}
                  onChange={(e) => set("max_login_attempts", e.target.value)}
                  style={{ ...inputStyle, width: 80 }}
                  min={1}
                  max={20}
                />
              </SettingRow>
              <SaveBtn keys={["session_timeout_minutes", "max_login_attempts"]} />
            </>
          )}
        </SectionCard>

        {/* System */}
        <SectionCard title="System">
          {loading ? (
            <Sk h={14} />
          ) : (
            <>
              <SettingRow label="Auto Backup Database" description="Schedule automatic database backups (when worker is configured).">
                <Toggle value={bool("auto_backup_database")} onChange={() => toggleSetting("auto_backup_database")} label="Auto backup database" />
              </SettingRow>
              <SettingRow label="Audit Logs Enabled" description="Record admin actions in the audit log." last>
                <Toggle value={bool("audit_logs_enabled")} onChange={() => toggleSetting("audit_logs_enabled")} label="Audit logs enabled" />
              </SettingRow>
              <SaveBtn keys={["auto_backup_database", "audit_logs_enabled"]} />
            </>
          )}
        </SectionCard>

        {/* Danger Zone */}
        <div style={{ background: T.surface, border: `2px solid ${T.danger}`, borderRadius: 20, overflow: "hidden" }}>
          <div
            style={{
              padding: "18px 24px 16px",
              borderBottom: "1px solid #fecaca",
              background: "#fff5f5",
            }}
          >
            <span style={{ fontWeight: 800, fontSize: "1rem", color: T.danger }}>Danger Zone</span>
          </div>
          <div style={{ padding: "20px 24px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 20,
                padding: "18px 0",
                borderBottom: `1px solid ${T.border}`,
              }}
            >
              <div>
                <div style={{ fontSize: "0.9rem", fontWeight: 700, color: T.text, marginBottom: 3 }}>Clear Audit Logs</div>
                <div style={{ fontSize: "0.8rem", color: T.muted }}>Permanently delete all audit log records.</div>
              </div>
              <button
                type="button"
                disabled={saving}
                style={{ ...dangerBtn, border: `1px solid ${T.danger}`, background: "none", color: T.danger }}
                onClick={() =>
                  setModal({
                    type: "clear-audit",
                    title: "Clear all audit logs?",
                    message: "Every audit log entry will be permanently deleted. This cannot be undone.",
                    confirmLabel: "Clear Logs",
                    danger: true,
                  })
                }
              >
                Clear Logs
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, paddingTop: 18 }}>
              <div>
                <div style={{ fontSize: "0.9rem", fontWeight: 700, color: T.text, marginBottom: 3 }}>Reset Settings</div>
                <div style={{ fontSize: "0.8rem", color: T.muted }}>Restore all settings to factory defaults.</div>
              </div>
              <button
                type="button"
                disabled={saving}
                style={{ ...dangerBtn, border: "none", background: T.dangerBg, color: T.danger }}
                onClick={() =>
                  setModal({
                    type: "reset",
                    title: "Reset all settings?",
                    message: "All configuration values will be restored to defaults. Custom values will be lost.",
                    confirmLabel: "Reset Settings",
                    danger: true,
                  })
                }
              >
                Reset Settings
              </button>
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={!!modal}
        title={modal?.title ?? ""}
        message={modal?.message ?? ""}
        confirmLabel={modal?.confirmLabel ?? "Confirm"}
        danger={modal?.danger}
        loading={saving}
        onConfirm={runDangerAction}
        onCancel={() => !saving && setModal(null)}
      />

      <Toast toasts={toasts} />
    </>
  );
}
