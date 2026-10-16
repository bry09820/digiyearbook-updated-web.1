import { useState, useRef } from "react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { handleLogin } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [challenge, setChallenge] = useState("");
  const [setup, setSetup] = useState(null);
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const otpRefs = useRef([]);
  const logoSrc = "/images/NU_logo.png";

  const totpCode = otpDigits.join("");

  const handleOtpChange = (index, value) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...otpDigits];
    next[index] = digit;
    setOtpDigits(next);
    if (digit && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0)
      otpRefs.current[index - 1]?.focus();
    if (e.key === "ArrowLeft" && index > 0) otpRefs.current[index - 1]?.focus();
    if (e.key === "ArrowRight" && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const next = [...otpDigits];
    pasted.split("").forEach((d, i) => { next[i] = d; });
    setOtpDigits(next);
    const idx = next.findIndex((d) => !d);
    otpRefs.current[idx === -1 ? 5 : idx]?.focus();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = challenge
        ? await api.post("/admin/login/totp", { challenge, code: totpCode })
        : await api.post("/admin/login", { username, password });

      if (res.data?.two_factor_required) {
        setChallenge(res.data.challenge);
        setSetup(res.data.setup ?? null);
        setOtpDigits(["", "", "", "", "", ""]);
        return;
      }
      const { token, admin } = res.data;
      handleLogin(admin, token);
    } catch (err) {
      setError(err.response?.data?.message || "Invalid credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setChallenge("");
    setSetup(null);
    setOtpDigits(["", "", "", "", "", ""]);
    setError("");
  };

  /* Shared left panel */
  const LeftPanel = ({ desc }) => (
    <div
      style={{
        width: "420px",
        flexShrink: 0,
        background: "#0B1F3A",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "44px 40px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* decorative blobs */}
      <div style={{
        position: "absolute", top: -40, left: -40,
        width: 160, height: 160, borderRadius: "50%",
        background: "rgba(29,78,216,0.12)", pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", bottom: -56, right: -56,
        width: 220, height: 220, borderRadius: "50%",
        background: "rgba(201,168,76,0.06)", pointerEvents: "none",
      }} />

      {/* top content */}
      <div style={{ position: "relative", zIndex: 1 }}>
        {/* logo */}
        <div style={{
          width: 56, height: 56, borderRadius: 14, background: "#fff",
          border: "1.5px solid rgba(201,168,76,0.45)",
          display: "flex", alignItems: "center", justifyContent: "center",
          marginBottom: 24, overflow: "hidden",
        }}>
          <img
            src={logoSrc}
            alt="National University Logo"
            style={{ width: "86%", height: "86%", objectFit: "contain" }}
          />
        </div>

        <h2 style={{
          fontSize: 28, fontWeight: 700, color: "#fff",
          lineHeight: 1.2, letterSpacing: "-0.5px", margin: 0,
        }}>
          National<br />University
        </h2>

        <p style={{
          fontSize: 10, fontWeight: 700, letterSpacing: "0.14em",
          textTransform: "uppercase", color: "#C9A84C",
          marginTop: 8, marginBottom: 0,
        }}>
          Digital Yearbook Portal
        </p>

        <div style={{
          width: 36, height: 3, background: "#C9A84C",
          borderRadius: 2, opacity: 0.8, margin: "20px 0",
        }} />

        <p style={{
          fontSize: 13, color: "rgba(255,255,255,0.44)",
          lineHeight: 1.75, maxWidth: 260, margin: 0,
        }}>
          {desc}
        </p>
      </div>

      {/* security notice */}
      <div style={{
        position: "relative", zIndex: 1,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(201,168,76,0.22)",
        borderLeft: "3px solid #C9A84C",
        borderRadius: "0 10px 10px 0",
        padding: "14px 16px",
      }}>
        <p style={{
          fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
          textTransform: "uppercase", color: "#C9A84C", margin: "0 0 5px",
        }}>
          ⚠ Security Notice
        </p>
        <p style={{
          fontSize: 12, color: "rgba(255,255,255,0.42)",
          lineHeight: 1.65, margin: 0,
        }}>
          This system is actively monitored. All access attempts are logged.
          Unauthorized use is subject to institutional and legal action.
        </p>
      </div>
    </div>
  );

  /* Shared input focus handlers */
  const onFocus = (e) => {
    e.target.style.borderColor = "#3B82F6";
    e.target.style.boxShadow = "0 0 0 4px rgba(59,130,246,0.08)";
    e.target.style.background = "#fff";
  };
  const onBlur = (e) => {
    e.target.style.borderColor = "#E2E8F0";
    e.target.style.boxShadow = "none";
    e.target.style.background = "#F8FAFC";
  };

  const inputStyle = {
    height: 48, width: "100%", borderRadius: 10,
    border: "1.5px solid #E2E8F0", background: "#F8FAFC",
    padding: "0 14px 0 42px", fontSize: 14, color: "#0F172A",
    outline: "none", transition: "border 0.15s, box-shadow 0.15s, background 0.15s",
    boxSizing: "border-box",
  };

  const labelStyle = {
    display: "block", fontSize: 11, fontWeight: 700,
    letterSpacing: "0.1em", textTransform: "uppercase",
    color: "#94A3B8", marginBottom: 8,
  };

  const submitBtnStyle = {
    width: "100%", height: 48, borderRadius: 10,
    background: "#0B1F3A", border: "none", color: "#fff",
    fontSize: 13, fontWeight: 700, letterSpacing: "0.05em",
    cursor: "pointer", display: "flex", alignItems: "center",
    justifyContent: "center", gap: 8, transition: "background 0.15s",
  };

  const StepPill = ({ step }) => (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 7,
      background: "#EFF6FF", border: "1px solid #BFDBFE",
      borderRadius: 20, padding: "5px 12px", marginBottom: 20,
    }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#2563EB", display: "inline-block" }} />
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#1D4ED8" }}>
        {step}
      </span>
    </span>
  );

  const ErrorBox = () => error ? (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 10,
      background: "#FEF2F2", border: "1px solid #FECACA",
      borderLeft: "3px solid #EF4444", borderRadius: "0 8px 8px 0",
      padding: "12px 14px", marginBottom: 20,
    }}>
      <span style={{ color: "#DC2626", fontWeight: 700, marginTop: 1 }}>!</span>
      <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "#7F1D1D" }}>{error}</span>
      <button onClick={() => setError("")}
        style={{ background: "none", border: "none", color: "#DC2626", cursor: "pointer", fontSize: 16, lineHeight: 1 }}
        aria-label="Dismiss">×</button>
    </div>
  ) : null;

  /* Page */
  return (
    <div style={{
      minHeight: "100vh", display: "flex",
      alignItems: "center", justifyContent: "center",
      background: "#F1F5F9", padding: "24px 16px",
    }}>
      <div style={{
        display: "flex", width: "100%", maxWidth: 960,
        borderRadius: 20, overflow: "hidden",
        boxShadow: "0 20px 60px rgba(0,0,0,0.14)",
        border: "1px solid #E2E8F0",
      }}>

        {!challenge ? (
          <>
            {/* Left */}
            <LeftPanel desc="Secure administrative access for the NU Digital Yearbook system. Authorized personnel only." />

            {/* Right: credentials */}
            <div style={{
              flex: 1, background: "#fff",
              display: "flex", flexDirection: "column", justifyContent: "center",
              padding: "52px 52px",
            }}>
              <StepPill step="Step 1 of 2" />

              <h1 style={{ fontSize: 26, fontWeight: 700, color: "#0F172A", letterSpacing: "-0.4px", margin: "0 0 6px" }}>
                Admin Sign In
              </h1>
              <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.6, margin: "0 0 32px" }}>
                Enter your administrator credentials to continue.
              </p>

              <ErrorBox />

              <form onSubmit={handleSubmit}>
                {/* username */}
                <div style={{ marginBottom: 18 }}>
                  <label style={labelStyle}>Username</label>
                  <div style={{ position: "relative" }}>
                    <svg style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
                      width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#CBD5E1" strokeWidth="1.8" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                    </svg>
                    <input
                      type="text" name="username" placeholder="admin.username"
                      value={username} onChange={(e) => setUsername(e.target.value)}
                      required autoFocus
                      style={inputStyle} onFocus={onFocus} onBlur={onBlur}
                    />
                  </div>
                </div>

                {/* New password */}
                <div style={{ marginBottom: 32 }}>
                  <label style={labelStyle}>Password</label>
                  <div style={{ position: "relative" }}>
                    <svg style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
                      width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#CBD5E1" strokeWidth="1.8" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                    </svg>
                    <input
                      type={showPw ? "text" : "password"} name="password" placeholder="••••••••"
                      value={password} onChange={(e) => setPassword(e.target.value)}
                      required
                      style={{ ...inputStyle, paddingRight: 60 }}
                      onFocus={onFocus} onBlur={onBlur}
                    />
                    <button type="button" onClick={() => setShowPw((p) => !p)}
                      style={{
                        position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                        background: "none", border: "none", fontSize: 11, fontWeight: 700,
                        letterSpacing: "0.06em", color: "#94A3B8", cursor: "pointer", padding: "4px 6px",
                      }}>
                      {showPw ? "HIDE" : "SHOW"}
                    </button>
                  </div>
                </div>

                <button type="submit" disabled={loading}
                  style={{ ...submitBtnStyle, opacity: loading ? 0.65 : 1 }}
                  onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = "#172D52"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "#0B1F3A"; }}>
                  {loading ? "Authenticating…" : (
                    <>
                      Continue to Verification
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                      </svg>
                    </>
                  )}
                </button>
              </form>
            </div>
          </>
        ) : (
          <>
            {/* Left */}
            <LeftPanel desc={setup
              ? "Scan the QR code with Google Authenticator, or type the secret key. Then enter the 6-digit code the app shows."
              : "Open your Google Authenticator app and enter the 6-digit code shown for this account."} />

            {/* Right: TOTP */}
            <div style={{
              flex: 1, background: "#fff",
              display: "flex", flexDirection: "column", justifyContent: "center",
              padding: "40px 48px",
              maxHeight: "100vh",
              overflowY: "auto",
            }}>
              <StepPill step="Step 2 of 2" />

              <h1 style={{ fontSize: 26, fontWeight: 700, color: "#0F172A", letterSpacing: "-0.4px", margin: "0 0 6px" }}>
                {setup ? "Set up Authenticator" : "Two-Factor Auth"}
              </h1>
              <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.6, margin: "0 0 24px" }}>
                {setup
                  ? "Scan this QR code in Google Authenticator. You can also enter the secret key by hand."
                  : "Enter the 6-digit code from your Google Authenticator app."}
              </p>

              <ErrorBox />

              {setup && (
                <div style={{
                  marginBottom: 24, borderRadius: 14, padding: 16,
                  background: "#EFF6FF", border: "1px solid #BFDBFE",
                }}>
                  <img src={setup.qr_code_url} alt="Google Authenticator QR code" style={{
                    display: "block", margin: "0 auto 14px", width: 220, height: 220,
                    borderRadius: 12, border: "1px solid #BFDBFE", background: "#fff", padding: 8,
                  }} />
                  <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#1E3A8A", margin: "0 0 6px" }}>
                    Secret key
                  </p>
                  <code style={{
                    display: "block", wordBreak: "break-all", background: "#fff",
                    borderRadius: 8, padding: "10px 12px", fontSize: 14, fontWeight: 700, color: "#1E3A8A",
                    letterSpacing: "0.04em",
                  }}>{setup.secret}</code>
                  <p style={{ fontSize: 12, color: "#64748B", lineHeight: 1.5, margin: "10px 0 0" }}>
                    Account: {setup.issuer}:{setup.account}
                  </p>
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <label style={{ ...labelStyle, textAlign: "center", marginBottom: 14 }}>
                  Authenticator Code
                </label>

                <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 10 }}
                  onPaste={handleOtpPaste}>
                  {otpDigits.map((digit, i) => (
                    <input key={i}
                      ref={(el) => (otpRefs.current[i] = el)}
                      type="text" inputMode="numeric" maxLength={1}
                      value={digit} autoFocus={i === 0}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      style={{
                        width: 52, height: 58, borderRadius: 10,
                        border: "1.5px solid #E2E8F0", background: "#F8FAFC",
                        textAlign: "center", fontSize: 22, fontWeight: 700, color: "#0F172A",
                        outline: "none", transition: "border 0.15s, box-shadow 0.15s, background 0.15s",
                        boxSizing: "border-box",
                      }}
                      onFocus={onFocus} onBlur={onBlur}
                    />
                  ))}
                </div>

                <p style={{ textAlign: "center", fontSize: 12, color: "#94A3B8", marginBottom: 28 }}>
                  ⏱ Code refreshes every 30 seconds
                </p>

                <button type="submit" disabled={loading || totpCode.length < 6}
                  style={{ ...submitBtnStyle, opacity: (loading || totpCode.length < 6) ? 0.6 : 1 }}
                  onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = "#172D52"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "#0B1F3A"; }}>
                  {loading ? "Verifying…" : (
                    <>
                      <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round"
                          d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                      </svg>
                      Verify &amp; Sign In
                    </>
                  )}
                </button>

                <div style={{ textAlign: "center", marginTop: 16 }}>
                  <button type="button" onClick={handleBack}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      display: "inline-flex", alignItems: "center", gap: 6,
                      fontSize: 12, fontWeight: 600, color: "#94A3B8",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "#475569"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "#94A3B8"; }}>
                    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                    </svg>
                    Use different credentials
                  </button>
                </div>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}