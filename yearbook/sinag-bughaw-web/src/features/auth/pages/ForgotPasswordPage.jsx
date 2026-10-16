import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '@/api/auth.api';
import { usePlatformStats } from '@/utils/platformStats';

// steps: 'email' 'otp' 'reset' 'done'

export default function ForgotPasswordPage() {
  const stats = usePlatformStats();
  const navigate = useNavigate();

  const [step,         setStep]        = useState('email');
  const [email,        setEmail]       = useState('');
  const [otp,          setOtp]         = useState(['','','','','','']);
  const [resetToken,   setResetToken]  = useState('');
  const [password,     setPassword]    = useState('');
  const [confirm,      setConfirm]     = useState('');
  const [showPass,     setShowPass]    = useState(false);
  const [showConfirm,  setShowConfirm] = useState(false);
  const [error,        setError]       = useState('');
  const [loading,      setLoading]     = useState(false);
  const [resendTimer,  setResendTimer] = useState(0);
  const otpRefs = useRef([]);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  // Send reset OTP
  const handleEmailSubmit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      await authApi.forgotPassword(email);   // POST /auth/forgot-password
      setStep('otp'); setResendTimer(60);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send reset code. Please try again.');
    } finally { setLoading(false); }
  };

  // OTP helpers
  const handleOtpChange = (i, value) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...otp]; next[i] = value; setOtp(next);
    if (value && i < 5) otpRefs.current[i + 1]?.focus();
  };
  const handleOtpKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus();
  };
  const handleOtpPaste = (e) => {
    const p = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (p.length === 6) { setOtp(p.split('')); otpRefs.current[5]?.focus(); }
  };

  // Verify OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length < 6) { setError('Please enter all 6 digits.'); return; }
    setError(''); setLoading(true);
    try {
      const { data } = await authApi.verifyResetOtp(email, code); // POST /auth/otp/verify-reset
      setResetToken(data.reset_token);
      setStep('reset');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid or expired code.');
      setOtp(['','','','','','']); otpRefs.current[0]?.focus();
    } finally { setLoading(false); }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    try {
      await authApi.forgotPassword(email);
      setOtp(['','','','','','']); setResendTimer(60); setError('');
      otpRefs.current[0]?.focus();
    } catch { setError('Failed to resend code. Please try again.'); }
  };

  // Set password
  const handleResetSubmit = async (e) => {
    e.preventDefault(); setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      await authApi.resetPassword({ email, reset_token: resetToken, password, password_confirmation: confirm });
      setStep('done');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not reset password. Please try again.');
    } finally { setLoading(false); }
  };

  // Back logic
  const handleBack = () => {
    setError('');
    if (step === 'otp')   { setStep('email'); setOtp(['','','','','','']); }
    if (step === 'reset') { setStep('otp');   setOtp(['','','','','','']); }
  };

  // Step meta
  const stepIcon  = { email: 'fa-lock-open', otp: 'fa-envelope-open-text', reset: 'fa-key', done: 'fa-circle-check' };
  const stepColor = { email: 'bg-indigo-50 text-[#3f51b5]', otp: 'bg-emerald-50 text-emerald-600', reset: 'bg-amber-50 text-amber-600', done: 'bg-emerald-50 text-emerald-600' };

  return (
    <div className="min-h-screen flex font-sans">
      <style>{`
        @keyframes slideLeft  { from{opacity:0;transform:translateX(-20px)} to{opacity:1;transform:translateX(0)} }
        @keyframes slideRight { from{opacity:0;transform:translateX(20px)}  to{opacity:1;transform:translateX(0)} }
        @keyframes slideUp    { from{opacity:0;transform:translateY(14px)}  to{opacity:1;transform:translateY(0)} }
        @keyframes shake      { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-5px)} 75%{transform:translateX(5px)} }
        @keyframes spin       { to{transform:rotate(360deg)} }
        @keyframes float      { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes pop        { 0%{transform:scale(0.7);opacity:0} 70%{transform:scale(1.1)} 100%{transform:scale(1);opacity:1} }
      `}</style>

      {/* LEFT PANEL */}
      <div
        className="hidden lg:flex lg:w-[45%] flex-col justify-between p-12 animate-[slideLeft_0.6s_ease]"
        style={{ background:"linear-gradient(160deg,rgba(29,43,75,0.93),rgba(63,81,181,0.87)),url('/images/NU-building.jpg') center/cover no-repeat" }}
      >
        <Link to="/" className="no-underline flex items-center gap-3">
          <img src="/images/NU_logo.png" alt="NU Lipa" className="h-11 object-contain" />
          <div className="leading-tight">
            <p className="text-white font-black text-[13px] uppercase tracking-widest m-0">Sinag-Bughaw</p>
            <p className="text-[#fdb813] text-[9px] tracking-[2px] uppercase m-0 mt-0.5">Digital Yearbook</p>
          </div>
        </Link>

        <div className="animate-[float_4s_ease-in-out_infinite]">
          <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 mb-6 border border-white/15">
            <i className="fas fa-shield-halved text-[#fdb813] text-4xl mb-5 block" aria-hidden="true" />
            <h2 className="text-white text-[1.6rem] font-black mb-3 leading-tight tracking-tight">
              Account Recovery<br />Made Simple.
            </h2>
            <p className="text-white/65 text-sm leading-relaxed m-0">
              Verify your identity with a one-time code sent to your registered email, then set a new password securely.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {stats.map(({ value, label }) => (
              <div key={label} className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 text-center border border-white/10">
                <p className="text-[#fdb813] font-black text-xl m-0 leading-none">{value}</p>
                <p className="text-white/55 text-xs m-0 mt-1.5">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-white/35 text-xs">© {new Date().getFullYear()} National University Lipa · Sinag-Bughaw</p>
      </div>

      {/* RIGHT PANEL */}
      <div className="w-full lg:w-[55%] flex flex-col bg-[#f3f6fc] animate-[slideRight_0.6s_ease]">

        {/* Top bar */}
        <div className="px-8 sm:px-14 lg:px-16 pt-8">
          {step === 'done' ? (
            <div />
          ) : step === 'email' ? (
            <Link to="/login" className="inline-flex items-center gap-2.5 text-slate-400 hover:text-[#1d2b4b] text-sm font-semibold no-underline transition-colors group w-fit">
              <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center group-hover:bg-[#1d2b4b] group-hover:text-white transition-all">
                <i className="fas fa-arrow-left text-xs" aria-hidden="true" />
              </div>
              Back to Login
            </Link>
          ) : (
            <button onClick={handleBack}
              className="inline-flex items-center gap-2.5 text-slate-400 hover:text-[#1d2b4b] text-sm font-semibold transition-colors group w-fit border-none bg-transparent cursor-pointer p-0">
              <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center group-hover:bg-[#1d2b4b] group-hover:text-white transition-all">
                <i className="fas fa-arrow-left text-xs" aria-hidden="true" />
              </div>
              Back
            </button>
          )}
        </div>

        {/* Center */}
        <div className="flex-1 flex flex-col items-center justify-center px-5 sm:px-10 lg:px-14 py-8">

          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden self-start">
            <img src="/images/NU_logo.png" alt="NU Lipa" className="h-10 object-contain" />
            <div className="leading-tight">
              <p className="text-[#1d2b4b] font-black text-xs uppercase tracking-widest m-0">Sinag-Bughaw</p>
              <p className="text-[#fdb813] text-[9px] tracking-[2px] uppercase m-0 mt-0.5">Digital Yearbook</p>
            </div>
          </div>

          {/* Progress dots */}
          {step !== 'done' && (
            <div className="flex items-center gap-2 mb-4 w-full max-w-[440px] px-1">
              {['email','otp','reset'].map((s, i) => {
                const steps = ['email','otp','reset'];
                const current = steps.indexOf(step);
                const isActive = i === current;
                const isDone   = i < current;
                return (
                  <div key={s} className="flex items-center gap-2">
                    <div className={`flex items-center justify-center rounded-full text-xs font-bold transition-all duration-300
                      ${isDone   ? 'w-6 h-6 bg-emerald-500 text-white'        : ''}
                      ${isActive ? 'w-6 h-6 bg-[#1d2b4b] text-white shadow-md': ''}
                      ${!isActive && !isDone ? 'w-6 h-6 bg-slate-200 text-slate-400' : ''}`}>
                      {isDone ? <i className="fas fa-check text-[10px]" /> : i + 1}
                    </div>
                    {i < 2 && (
                      <div className={`h-px w-8 transition-all duration-500 ${i < current ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                    )}
                  </div>
                );
              })}
              <span className="ml-2 text-xs text-slate-400 font-medium">
                {step === 'email' ? 'Enter email'  : step === 'otp' ? 'Verify code' : 'New password'}
              </span>
            </div>
          )}

          <div className="w-full max-w-[440px] bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xl shadow-slate-200/70">

            {/* Email */}
            {step === 'email' && (
              <div className="animate-[slideUp_0.35s_ease]">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl mb-5 shadow-sm ${stepColor.email}`}>
                  <i className={`fas ${stepIcon.email}`} aria-hidden="true" />
                </div>
                <h1 className="text-[1.85rem] font-black text-[#1d2b4b] mb-1 tracking-tight">Forgot Password?</h1>
                <p className="text-slate-400 text-sm mb-6">Enter your registered email and we'll send a reset code.</p>

                {error && <ErrorBanner message={error} />}

                <form onSubmit={handleEmailSubmit} className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Email Address</label>
                    <div className="relative">
                      <i className="far fa-envelope absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 text-sm pointer-events-none" aria-hidden="true" />
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required autoFocus
                        placeholder="student@nu-lipa.edu.ph"
                        className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-[#3f51b5] focus:ring-4 focus:ring-[#3f51b5]/10 transition shadow-sm"
                      />
                    </div>
                  </div>

                  <button type="submit" disabled={loading}
                    className="w-full bg-[#1d2b4b] hover:bg-[#162038] disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2.5 shadow-lg cursor-pointer border-none text-sm">
                    {loading
                      ? <><span>Sending Code…</span><Spinner /></>
                      : <><span>Send Reset Code</span><i className="fas fa-paper-plane text-xs" aria-hidden="true" /></>}
                  </button>
                </form>

                <p className="text-center text-sm text-slate-400 mt-5">
                  Remembered it?{' '}
                  <Link to="/login" className="text-[#3f51b5] font-bold no-underline hover:underline">Sign In</Link>
                </p>

                <div className="mt-5 flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                  <i className="fas fa-info-circle text-blue-400 text-sm mt-0.5 shrink-0" aria-hidden="true" />
                  <p className="text-blue-700 text-xs m-0 leading-relaxed">
                    The code will be sent to your registered school email. Check your spam folder if you don't see it.
                  </p>
                </div>
              </div>
            )}

            {/* OTP */}
            {step === 'otp' && (
              <div className="animate-[slideUp_0.35s_ease]">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl mb-5 shadow-sm ${stepColor.otp}`}>
                  <i className={`fas ${stepIcon.otp}`} aria-hidden="true" />
                </div>
                <h1 className="text-[1.85rem] font-black text-[#1d2b4b] mb-1 tracking-tight">Check Your Email</h1>
                <p className="text-slate-400 text-sm mb-1">We sent a 6-digit reset code to:</p>
                <p className="text-[#3f51b5] font-bold text-sm mb-6">{email}</p>

                {error && <ErrorBanner message={error} />}

                <form onSubmit={handleVerifyOtp}>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3 text-center">
                    Enter Reset Code
                  </label>
                  <div className="flex gap-2 justify-center mb-6" onPaste={handleOtpPaste}>
                    {otp.map((digit, i) => (
                      <input
                        key={i}
                        ref={el => (otpRefs.current[i] = el)}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={e => handleOtpChange(i, e.target.value)}
                        onKeyDown={e => handleOtpKeyDown(i, e)}
                        className={`w-12 h-12 text-center text-lg font-black bg-white border-2 rounded-xl outline-none transition-all shadow-sm
                          ${digit
                            ? 'border-[#3f51b5] bg-indigo-50 text-[#1d2b4b]'
                            : 'border-slate-200 text-slate-300'}
                          focus:border-[#3f51b5] focus:bg-indigo-50 focus:ring-4 focus:ring-[#3f51b5]/10`}
                      />
                    ))}
                  </div>

                  <button type="submit" disabled={loading}
                    className="w-full bg-[#1d2b4b] hover:bg-[#162038] disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2.5 shadow-lg cursor-pointer border-none text-sm">
                    {loading
                      ? <><span>Verifying…</span><Spinner /></>
                      : <><span>Verify Code</span><i className="fas fa-check text-xs" aria-hidden="true" /></>}
                  </button>
                </form>

                <div className="text-center mt-5 p-4 bg-slate-50 border border-slate-100 rounded-xl">
                  <p className="text-slate-400 text-xs mb-1.5">Didn't receive the code?</p>
                  {resendTimer > 0
                    ? <p className="text-slate-500 text-sm m-0">
                        Resend available in <span className="font-bold text-[#3f51b5]">{resendTimer}s</span>
                      </p>
                    : <button onClick={handleResend}
                        className="text-[#3f51b5] font-bold text-sm hover:underline bg-transparent border-none cursor-pointer">
                        Resend Code
                      </button>
                  }
                </div>

                <p className="text-center text-xs text-slate-400 mt-3">
                  Wrong email?{' '}
                  <button
                    onClick={() => { setStep('email'); setError(''); setOtp(['','','','','','']); }}
                    className="text-[#3f51b5] font-semibold hover:underline bg-transparent border-none cursor-pointer text-xs"
                  >
                    Go back
                  </button>
                </p>
              </div>
            )}

            {/* New password */}
            {step === 'reset' && (
              <div className="animate-[slideUp_0.35s_ease]">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl mb-5 shadow-sm ${stepColor.reset}`}>
                  <i className={`fas ${stepIcon.reset}`} aria-hidden="true" />
                </div>
                <h1 className="text-[1.85rem] font-black text-[#1d2b4b] mb-1 tracking-tight">New Password</h1>
                <p className="text-slate-400 text-sm mb-6">Choose a strong password for your account.</p>

                {error && <ErrorBanner message={error} />}

                <form onSubmit={handleResetSubmit} className="space-y-4">
                  {/* Password */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">New Password</label>
                    <div className="relative">
                      <i className="fas fa-lock absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 text-sm pointer-events-none" aria-hidden="true" />
                      <input
                        type={showPass ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required autoFocus
                        placeholder="Min. 8 characters"
                        className="w-full pl-10 pr-10 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-[#3f51b5] focus:ring-4 focus:ring-[#3f51b5]/10 transition shadow-sm"
                      />
                      <button type="button" onClick={() => setShowPass(v => !v)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 bg-transparent border-none cursor-pointer p-0">
                        <i className={`fas ${showPass ? 'fa-eye-slash' : 'fa-eye'} text-sm`} aria-hidden="true" />
                      </button>
                    </div>
                    {/* Strength bar */}
                    <PasswordStrength password={password} />
                  </div>

                  {/* Confirm */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Confirm Password</label>
                    <div className="relative">
                      <i className="fas fa-lock absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 text-sm pointer-events-none" aria-hidden="true" />
                      <input
                        type={showConfirm ? 'text' : 'password'}
                        value={confirm}
                        onChange={e => setConfirm(e.target.value)}
                        required
                        placeholder="Repeat your password"
                        className={`w-full pl-10 pr-10 py-3 bg-white border rounded-xl text-sm outline-none transition shadow-sm
                          ${confirm && confirm !== password
                            ? 'border-red-300 focus:border-red-400 focus:ring-4 focus:ring-red-400/10'
                            : 'border-slate-200 focus:border-[#3f51b5] focus:ring-4 focus:ring-[#3f51b5]/10'}`}
                      />
                      <button type="button" onClick={() => setShowConfirm(v => !v)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 bg-transparent border-none cursor-pointer p-0">
                        <i className={`fas ${showConfirm ? 'fa-eye-slash' : 'fa-eye'} text-sm`} aria-hidden="true" />
                      </button>
                    </div>
                    {confirm && confirm !== password && (
                      <p className="text-red-500 text-xs mt-1 ml-1">Passwords do not match</p>
                    )}
                  </div>

                  <button type="submit" disabled={loading}
                    className="w-full bg-[#1d2b4b] hover:bg-[#162038] disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2.5 shadow-lg cursor-pointer border-none text-sm">
                    {loading
                      ? <><span>Updating…</span><Spinner /></>
                      : <><span>Reset Password</span><i className="fas fa-shield-check text-xs" aria-hidden="true" /></>}
                  </button>
                </form>
              </div>
            )}

            {/* Done */}
            {step === 'done' && (
              <div className="animate-[slideUp_0.35s_ease] text-center">
                <div className="w-20 h-20 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center text-4xl mx-auto mb-6 shadow-sm animate-[pop_0.5s_ease]">
                  <i className="fas fa-circle-check" aria-hidden="true" />
                </div>
                <h1 className="text-[1.85rem] font-black text-[#1d2b4b] mb-2 tracking-tight">Password Reset!</h1>
                <p className="text-slate-400 text-sm mb-8 leading-relaxed">
                  Your password has been updated successfully.<br />You can now sign in with your new password.
                </p>

                <button
                  onClick={() => navigate('/login', { replace: true })}
                  className="w-full bg-[#1d2b4b] hover:bg-[#162038] text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2.5 shadow-lg cursor-pointer border-none text-sm">
                  <span>Go to Sign In</span>
                  <i className="fas fa-arrow-right text-xs" aria-hidden="true" />
                </button>

                <div className="mt-5 flex items-start gap-3 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 text-left">
                  <i className="fas fa-circle-info text-emerald-500 text-sm mt-0.5 shrink-0" aria-hidden="true" />
                  <p className="text-emerald-700 text-xs m-0 leading-relaxed">
                    For your security, all active sessions on other devices have been logged out.
                  </p>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}

// Password strength indicator
function PasswordStrength({ password }) {
  if (!password) return null;
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  const score  = checks.filter(Boolean).length;
  const labels = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];
  const colors = ['bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-lime-500', 'bg-emerald-500'];

  return (
    <div className="mt-2">
      <div className="flex gap-1">
        {[0,1,2,3].map(i => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i < score ? colors[score] : 'bg-slate-200'}`} />
        ))}
      </div>
      <p className={`text-xs mt-1 font-semibold ${score <= 1 ? 'text-red-500' : score === 2 ? 'text-yellow-600' : score === 3 ? 'text-lime-600' : 'text-emerald-600'}`}>
        {labels[score]}
      </p>
    </div>
  );
}

// Shared sub-components
function ErrorBanner({ message }) {
  return (
    <div className="flex items-center gap-3 bg-red-50 text-red-600 border-l-4 border-red-500 rounded-xl px-4 py-3 text-sm mb-5 animate-[shake_0.4s_ease]">
      <i className="fas fa-exclamation-circle shrink-0" aria-hidden="true" /> {message}
    </div>
  );
}
function Spinner() {
  return <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-[spin_0.7s_linear_infinite]" />;
}
