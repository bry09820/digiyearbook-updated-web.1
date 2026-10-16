import { useState, useEffect, useMemo } from 'react';
import { profileSettingsApi } from '@/api/profile.api';
import { studentsApi } from '@/api/student.api';
import { alumniApi } from '@/api/alumni.api';
import { useAuth } from '@/features/auth/hooks/useAuth';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import { isAlumniAccount } from '@/utils/academicStatus';
import { YEAR_OPTIONS } from '@/api/batch.api';

const VISIBILITY_OPTS = [
  { v: 'public',      icon: 'fa-globe',          label: 'Public',      desc: 'Anyone can view your profile'         },
  { v: 'batchmates',  icon: 'fa-users',          label: 'Batchmates',  desc: 'Only students from your graduation year can view' },
  { v: 'private',     icon: 'fa-lock',           label: 'Private',     desc: 'Only you can view your profile'       },
];

const ACHIEVEMENT_ICON_OPTIONS = [
  { icon: 'fa-code',        label: 'Code'        },
  { icon: 'fa-lightbulb',   label: 'Idea'        },
  { icon: 'fa-star',        label: 'Star'        },
  { icon: 'fa-trophy',      label: 'Trophy'      },
  { icon: 'fa-medal',       label: 'Medal'       },
  { icon: 'fa-certificate', label: 'Certificate' },
  { icon: 'fa-flask',       label: 'Science'     },
  { icon: 'fa-music',       label: 'Music'       },
  { icon: 'fa-palette',     label: 'Art'         },
  { icon: 'fa-futbol',      label: 'Sports'      },
];

const ACHIEVEMENT_COLOR_OPTIONS = [
  '#3f51b5', '#f59e0b', '#fdb813', '#10b981', '#ef4444',
  '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#1d2b4b',
];

// No DEFAULT_ACHIEVEMENTS here we always load from the real DB

const NAV_SECTIONS = [
  { id: 'visibility',   icon: 'fa-eye',           label: 'Visibility'   },
  { id: 'motto',        icon: 'fa-quote-left',    label: 'Motto'        },
  { id: 'academic',     icon: 'fa-graduation-cap',label: 'Academic'     },
  { id: 'achievements', icon: 'fa-award',         label: 'Achievements' },
  { id: 'password',     icon: 'fa-lock',          label: 'Password'     },
];

const CAREER_SECTION = { id: 'career', icon: 'fa-briefcase', label: 'Career' };

const isMeaningfulText = (value, minLength = 10) => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  const compact = text.replace(/[^a-z0-9]/gi, '').toLowerCase();
  if (text.length < minLength || compact.length < minLength) return false;
  if (/^(test|asdf|qwerty|sample|lorem|abc|haha)+$/i.test(compact)) return false;
  if (/^(.)\1{2,}$/.test(compact)) return false;
  return true;
};

const parseAchievementType = (value) => {
  try {
    return JSON.parse(value || '{}');
  } catch {
    return {};
  }
};

const isGraduateUser = (user) => isAlumniAccount(user);

export default function SettingsPage() {
  const { user, fetchUser } = useAuth();
  const canEditCareer = isGraduateUser(user);
  const navSections = useMemo(() => (
    canEditCareer
      ? [...NAV_SECTIONS.slice(0, 3), CAREER_SECTION, ...NAV_SECTIONS.slice(3)]
      : NAV_SECTIONS
  ), [canEditCareer]);

  // Visibility
  const [visibility, setVis] = useState(user?.profile_visibility === 'alumni_only' ? 'batchmates' : (user?.profile_visibility ?? 'public'));
  const [visibilitySaving, setVisibilitySaving] = useState(false);

  // Motto
  const [motto, setMotto] = useState(user?.motto ?? '');
  const [mottoSaving, setMottoSaving] = useState(false);

  // Password
  const [loading,     setLoading]     = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew,     setShowNew]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwForm, setPwForm] = useState({
    current_password: '', password: '', password_confirmation: '',
  });
  const [pwErrors, setPwErrors] = useState({});

  // Academic
  const [academicForm, setAcademicForm] = useState({
    student_id:      user?.student_id      ?? '',
    course:          user?.course          ?? '',
    graduation_year: user?.graduation_year ?? '',
    batch:           user?.batch           ?? '',
  });
  const [academicSaving, setAcademicSaving] = useState(false);

  // Career / Alumni Tracker
  const [careerForm, setCareerForm] = useState({
    job_title: '', company: '', location: '', field: '', bio: '',
  });
  const [careerLoading, setCareerLoading] = useState(false);
  const [careerSaving, setCareerSaving] = useState(false);

  // Achievements
  const [achievements,   setAchievements]   = useState([]);
  const [achieveLoading, setAchieveLoading] = useState(false);
  const [achieveSaving,  setAchieveSaving]  = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(null);

  // Toast
  const [toast, setToast] = useState(null);
  const [activeSection, setActiveSection] = useState(navSections[0].id);
  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    if (type === 'success') window.dispatchEvent(new Event('notifications:refresh'));
    setTimeout(() => setToast(null), 3000);
  };

  // Load achievements from API on mount
  // FIX: removed DEFAULT_ACHIEVEMENTS fallback empty list is correct when
  //      the user has no achievements yet; fake ids 1/2/3 caused the controller
  //      to silently skip creates and delete everything on save.
  useEffect(() => {
    if (!user?.id) return;
    queueMicrotask(() => setAchieveLoading(true));
    studentsApi.getAchievements(user.id)
      .then(res => {
        const data = res.data?.data ?? [];
        if (Array.isArray(data) && data.length) {
          setAchievements(data.map(a => {
            const meta = parseAchievementType(a.type);
            return {
              id:    a.id,
              t:     a.title,
              s:     a.subtitle ?? '',
              icon:  meta.icon  ?? 'fa-star',
              color: meta.color ?? '#fdb813',
            };
          }));
        } else {
          // User genuinely has no achievements yet start empty, not with fake data
          setAchievements([]);
        }
      })
      .catch(() => setAchievements([]))
      .finally(() => setAchieveLoading(false));
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !canEditCareer) return;
    queueMicrotask(() => setCareerLoading(true));
    alumniApi.me()
      .then(({ data }) => {
        const career = data?.data?.career ?? data?.career ?? {};
        setCareerForm({
          job_title: career?.job_title ?? '',
          company:   career?.company   ?? '',
          location:  career?.location  ?? '',
          field:     career?.field     ?? '',
          bio:       career?.bio       ?? '',
        });
      })
      .catch(() => setCareerForm(current => current))
      .finally(() => setCareerLoading(false));
  }, [canEditCareer, user?.id]);

  useEffect(() => {
    const onScroll = () => {
      const current = navSections
        .map(section => {
          const el = document.getElementById(section.id);
          return el ? { id: section.id, top: Math.abs(el.getBoundingClientRect().top - 120) } : null;
        })
        .filter(Boolean)
        .sort((a, b) => a.top - b.top)[0];
      if (current) setActiveSection(current.id);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [navSections]);

  // Handlers
  const saveVisibility = async () => {
    setVisibilitySaving(true);
    try {
      await profileSettingsApi.updateVisibility(visibility);
      try { await fetchUser(); } catch { /* saved visibility still applies on the next request */ }
      showToast('Your profile visibility was updated successfully.');
    } catch {
      showToast('Failed to save visibility.', 'error');
    } finally {
      setVisibilitySaving(false);
    }
  };

  const saveMotto = async () => {
    if (motto.trim() && !isMeaningfulText(motto, 10)) {
      showToast('Please enter a meaningful bio.', 'error');
      return;
    }
    setMottoSaving(true);
    try {
      await profileSettingsApi.updateMotto(motto);
      showToast('Your motto was updated successfully.');
    } catch {
      showToast('Failed to save motto.', 'error');
    } finally {
      setMottoSaving(false);
    }
  };

  const validatePw = () => {
    const e = {};
    if (!pwForm.current_password)                         e.current_password = 'Current password is required.';
    if (pwForm.password.length < 8)                       e.password = 'Must be at least 8 characters.';
    else if (!/[0-9]/.test(pwForm.password))              e.password = 'Must contain at least one number.';
    if (pwForm.password !== pwForm.password_confirmation) e.password_confirmation = 'Passwords do not match.';
    return e;
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    const errs = validatePw();
    if (Object.keys(errs).length) { setPwErrors(errs); return; }
    setLoading(true); setPwErrors({});
    try {
      await studentsApi.updatePassword(pwForm);
      showToast('Your password was updated successfully.');
      setPwForm({ current_password: '', password: '', password_confirmation: '' });
    } catch (err) {
      const apiErrors = err.response?.data?.errors || {};
      const apiMsg    = err.response?.data?.message || 'Failed to change password.';
      setPwErrors(Object.keys(apiErrors).length ? apiErrors : { general: apiMsg });
    } finally { setLoading(false); }
  };

  const saveAcademic = async () => {
    setAcademicSaving(true);
    try {
      const res = await studentsApi.updateAcademic(academicForm);
      const updated = res.data?.user;
      if (updated) {
        setAcademicForm({
          student_id:      updated.student_id      ?? '',
          course:          updated.course          ?? '',
          graduation_year: updated.graduation_year ?? '',
          batch:           updated.batch           ?? '',
        });
      }
      showToast('Your academic info was updated successfully.');
    } catch {
      showToast('Failed to update academic info.', 'error');
    } finally { setAcademicSaving(false); }
  };

  const saveCareer = async () => {
    if (careerForm.bio.trim() && !isMeaningfulText(careerForm.bio, 12)) {
      showToast('Please enter a meaningful career bio.', 'error');
      return;
    }

    setCareerSaving(true);
    try {
      await alumniApi.updateCareer({
        job_title: careerForm.job_title || null,
        company:   careerForm.company   || null,
        location:  careerForm.location  || null,
        field:     careerForm.field     || null,
        bio:       careerForm.bio       || null,
      });
      showToast('Your alumni career profile was updated successfully.');
    } catch {
      showToast('Failed to save career profile.', 'error');
    } finally {
      setCareerSaving(false);
    }
  };

  const addAchievement = () =>
    setAchievements(prev => [...prev, { id: null, t: '', s: '', icon: 'fa-star', color: '#fdb813' }]);
    // FIX: use null instead of Date.now() Date.now() produces a large numeric
    //      id that fools the controller into treating it as an existing record.

  const removeAchievement = (idx) =>
    setAchievements(prev => prev.filter((_, i) => i !== idx));

  const updateAchievement = (idx, field, value) =>
    setAchievements(prev => prev.map((a, i) => i === idx ? { ...a, [field]: value } : a));

  const saveAchievements = async () => {
    setAchieveSaving(true);
    try {
      const payload = achievements.map(({ id, t, s, icon, color }) => ({
        id:       id,   // null for new records, real DB id for existing
        title:    t,
        subtitle: s,
        type:     JSON.stringify({ icon, color }),
      }));
      await studentsApi.updateAchievements(payload);
      showToast('Your achievements were updated successfully.');
      setShowIconPicker(null);

      // Reload achievements from DB so local ids are replaced with real DB ids
      const res  = await studentsApi.getAchievements(user.id);
      const data = res.data?.data ?? [];
      setAchievements(data.map(a => {
        const meta = parseAchievementType(a.type);
        return { id: a.id, t: a.title, s: a.subtitle ?? '', icon: meta.icon ?? 'fa-star', color: meta.color ?? '#fdb813' };
      }));
    } catch {
      showToast('Failed to save achievements.', 'error');
    } finally { setAchieveSaving(false); }
  };

  const pwStrength = [
    { label: 'At least 8 characters', ok: pwForm.password.length >= 8     },
    { label: 'Contains a number',     ok: /[0-9]/.test(pwForm.password)    },
    { label: 'Contains a letter',     ok: /[a-zA-Z]/.test(pwForm.password) },
  ];

  const scrollTo = (id) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const inputCls = (hasErr) =>
    `w-full px-4 py-3 border-2 rounded-xl text-sm outline-none transition bg-slate-50 text-[#1d2b4b]
     focus:ring-4 focus:ring-[#3f51b5]/10
     ${hasErr ? 'border-red-400 focus:border-red-400' : 'border-slate-200 focus:border-[#3f51b5]'}`;

  return (
    <div className="min-h-screen flex flex-col bg-[#f4f7fe] font-sans">
      <style>{`
        @keyframes slideIn { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:translateX(0)} }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(8px)}  to{opacity:1;transform:translateY(0)} }
      `}</style>

      <Navbar />

      {/* Toast */}
      {toast && (
        <div className={`fixed right-6 top-24 z-[2000] flex items-center gap-2 text-white text-sm font-semibold px-5 py-3 rounded-xl shadow-xl animate-[slideIn_0.3s_ease]
          ${toast.type === 'error' ? 'bg-red-500 shadow-red-200/50' : 'bg-emerald-500 shadow-emerald-200/50'}`}>
          <i className={`fas fa-${toast.type === 'error' ? 'circle-xmark' : 'check-circle'}`} />
          {toast.msg}
        </div>
      )}

      <div className="flex-1 max-w-[960px] mx-auto w-full px-4 sm:px-6 py-10 flex gap-8 items-start">

        {/* Sticky sidebar nav */}
        <aside className="hidden lg:flex flex-col gap-1 w-52 shrink-0 sticky top-24">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-3 mb-2">Settings</p>
          {navSections.map(s => (
            <button key={s.id} onClick={() => scrollTo(s.id)}
              className={`flex items-center gap-2.5 rounded-xl border-0 border-l-4 px-3 py-2.5 text-left text-sm font-semibold transition-all cursor-pointer
                         ${activeSection === s.id ? 'border-l-amber-400 bg-[#1d2b4b] text-white shadow-sm' : 'border-l-transparent bg-transparent text-slate-500 hover:bg-white hover:text-[#1d2b4b] hover:shadow-sm'}`}>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${activeSection === s.id ? 'bg-[#fdb813]/20' : 'bg-slate-100'}`}>
                <i className={`fas ${s.icon} text-[11px] ${activeSection === s.id ? 'text-[#fdb813]' : 'text-slate-400'}`} />
              </div>
              {s.label}
            </button>
          ))}
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 max-w-2xl mx-auto w-full flex flex-col gap-4 animate-[fadeUp_0.35s_ease]">

          {/* Page header */}
          <div className="mb-2">
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1">Account</p>
            <h1 className="text-[1.85rem] font-black text-[#1d2b4b] tracking-tight m-0 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#1d2b4b] flex items-center justify-center shrink-0">
                <i className="fas fa-cog text-white text-base" />
              </div>
              Profile Settings
            </h1>
          </div>

          {/* 1. Profile Visibility */}
          <Section id="visibility" icon="fa-eye" iconBg="bg-indigo-50" iconColor="text-[#3f51b5]"
            title="Profile Visibility" desc="Control who can see your profile">
            <div className="space-y-2 mb-5">
              {VISIBILITY_OPTS.map(opt => (
                <button key={opt.v} onClick={() => setVis(opt.v)}
                  className={`w-full text-left px-4 py-4 rounded-xl border-2 cursor-pointer transition-all bg-transparent
                    ${visibility === opt.v
                      ? 'border-[#3f51b5] bg-indigo-50'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all
                      ${visibility === opt.v ? 'bg-[#3f51b5] text-white' : 'bg-slate-100 text-slate-500'}`}>
                      <i className={`fas ${opt.icon} text-sm`} />
                    </div>
                    <div>
                      <p className={`text-sm font-bold m-0 ${visibility === opt.v ? 'text-[#1d2b4b]' : 'text-slate-700'}`}>
                        {opt.label}
                      </p>
                      <p className="text-xs text-slate-400 m-0 mt-0.5">{opt.desc}</p>
                    </div>
                    {visibility === opt.v && (
                      <i className="fas fa-check-circle text-[#3f51b5] text-base ml-auto" />
                    )}
                  </div>
                </button>
              ))}
            </div>
            <SaveButton onClick={saveVisibility} loading={visibilitySaving} label="Save Visibility" loadingLabel="Saving..." />
          </Section>

          {/* 2. Personal Motto */}
          <Section id="motto" icon="fa-quote-left" iconBg="bg-amber-50" iconColor="text-[#fdb813]"
            title="Personal Motto" desc="Appears on your yearbook profile">
            <textarea
              value={motto}
              onChange={e => setMotto(e.target.value)}
              maxLength={255}
              rows={3}
              placeholder="Write your personal motto or yearbook quote…"
              className="w-full resize-none outline-none text-sm text-[#1d2b4b] bg-slate-50 border-2 border-slate-200
                         rounded-xl px-4 py-3 leading-relaxed mb-4 transition-colors focus:border-[#3f51b5] box-border"
              style={{ fontFamily: 'inherit' }}
            />
            <div className="flex items-center justify-between mb-4">
              <span className="text-[11px] text-slate-400">{motto.length}/255 characters</span>
            </div>
            <SaveButton onClick={saveMotto} loading={mottoSaving} label="Save Motto" loadingLabel="Saving..." />
          </Section>

          {/* 3. Academic Info */}
          <Section id="academic" icon="fa-graduation-cap" iconBg="bg-blue-50" iconColor="text-[#3f51b5]"
            title="Academic Info" desc="Your graduation details shown on your yearbook profile">
            <div className="space-y-4 mb-5">

              {/* Student ID */}
              <div>
                <label className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">
                  <i className="fas fa-id-card text-[#fdb813] text-[9px]" /> Student ID
                </label>
                <input
                  type="text"
                  value={academicForm.student_id}
                  onChange={e => setAcademicForm(p => ({ ...p, student_id: e.target.value }))}
                  placeholder="e.g. 2021-00001"
                  className={inputCls(false)}
                />
              </div>

              {/* Course */}
              <div>
                <label className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">
                  <i className="fas fa-book text-[#fdb813] text-[9px]" /> Course
                </label>
                <input
                  type="text"
                  value={academicForm.course}
                  onChange={e => setAcademicForm(p => ({ ...p, course: e.target.value }))}
                  placeholder="e.g. Bachelor of Science in Information Technology"
                  className={inputCls(false)}
                />
              </div>

              {/* Graduation Year + Batch side by side */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">
                    <i className="fas fa-calendar text-[#fdb813] text-[9px]" /> Graduation Year
                  </label>
                  <select
                    value={academicForm.graduation_year}
                    onChange={e => setAcademicForm(p => ({ ...p, graduation_year: e.target.value }))}
                    className={inputCls(false)}
                  >
                    <option value="">Select batch year</option>
                    {YEAR_OPTIONS.map(year => (
                      <option key={year} value={year}>Batch {year}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">
                    <i className="fas fa-users text-[#fdb813] text-[9px]" /> Batch
                  </label>
                  <input
                    type="text"
                    value={academicForm.batch}
                    onChange={e => setAcademicForm(p => ({ ...p, batch: e.target.value }))}
                    placeholder="e.g. Batch 2026"
                    className={inputCls(false)}
                  />
                </div>
              </div>
            </div>

<SaveButton onClick={saveAcademic} loading={academicSaving} label="Save Academic Info" loadingLabel="Saving..." icon="fa-graduation-cap" />
          </Section>

          {canEditCareer && (
          <Section id="career" icon="fa-briefcase" iconBg="bg-emerald-50" iconColor="text-emerald-600"
            title="Career Path" desc="Shown in Alumni Tracker so classmates can see where you are now">
            {careerLoading ? (
              <LoadingSkeleton variant="row" count={3} gridClassName="space-y-3" />
            ) : (
              <>
                <div className="space-y-4 mb-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">
                        <i className="fas fa-briefcase text-[#fdb813] text-[9px]" /> Job Title
                      </label>
                      <input type="text" value={careerForm.job_title} onChange={e => setCareerForm(p => ({ ...p, job_title: e.target.value }))} placeholder="e.g. Software Engineer" className={inputCls(false)} />
                    </div>
                    <div>
                      <label className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">
                        <i className="fas fa-building text-[#fdb813] text-[9px]" /> Company
                      </label>
                      <input type="text" value={careerForm.company} onChange={e => setCareerForm(p => ({ ...p, company: e.target.value }))} placeholder="e.g. Accenture" className={inputCls(false)} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">
                        <i className="fas fa-location-dot text-[#fdb813] text-[9px]" /> Location
                      </label>
                      <input type="text" value={careerForm.location} onChange={e => setCareerForm(p => ({ ...p, location: e.target.value }))} placeholder="e.g. Makati" className={inputCls(false)} />
                    </div>
                    <div>
                      <label className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">
                        <i className="fas fa-tag text-[#fdb813] text-[9px]" /> Career Field
                      </label>
                      <input type="text" value={careerForm.field} onChange={e => setCareerForm(p => ({ ...p, field: e.target.value }))} placeholder="e.g. Technology" className={inputCls(false)} />
                    </div>
                  </div>

                  <div>
                    <label className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">
                      <i className="fas fa-align-left text-[#fdb813] text-[9px]" /> Career Bio
                    </label>
                    <textarea
                      value={careerForm.bio}
                      onChange={e => setCareerForm(p => ({ ...p, bio: e.target.value }))}
                      rows={4}
                      maxLength={500}
                      placeholder="Share a short update about your career path..."
                      className="w-full resize-none outline-none text-sm text-[#1d2b4b] bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 leading-relaxed transition-colors focus:border-[#3f51b5] box-border"
                      style={{ fontFamily: 'inherit' }}
                    />
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[11px] text-slate-400">{careerForm.bio.length}/500 characters</span>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 mb-4 text-xs text-amber-700 leading-relaxed">
                  <i className="fas fa-circle-info text-[#fdb813] mr-1.5" />
                  These details appear on the Alumni Tracker page after you save them.
                </div>

                <SaveButton onClick={saveCareer} loading={careerSaving} label="Save Career Path" loadingLabel="Saving..." icon="fa-briefcase" />
              </>
            )}
          </Section>
          )}

          {/* 4. Achievements */}
          <Section id="achievements" icon="fa-award" iconBg="bg-amber-50" iconColor="text-amber-500"
            title="Achievements" desc="Add or edit the achievements shown on your yearbook profile">

            {achieveLoading ? (
              <LoadingSkeleton variant="row" count={3} gridClassName="space-y-3" />
            ) : (
              <>
                <div className="space-y-3 mb-3">
                  {achievements.map((a, idx) => (
                    <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 relative">

                      {/* Remove */}
                      <button
                        onClick={() => removeAchievement(idx)}
                        className="absolute top-3 right-3 w-7 h-7 rounded-full bg-red-50 border border-red-100
                                   text-red-400 hover:bg-red-100 flex items-center justify-center text-xs
                                   cursor-pointer transition border-none"
                        title="Remove"
                      >
                        <i className="fas fa-xmark" />
                      </button>

                      {/* Preview row */}
                      <div className="flex items-center gap-3 pr-8">
                        <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0">
                          <i className={`fas ${a.icon} text-sm`} style={{ color: a.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-[#1d2b4b] m-0 truncate">{a.t || 'Achievement title'}</p>
                          <p className="text-xs text-slate-400 m-0 truncate">{a.s || 'Event / description'}</p>
                        </div>
                      </div>

                      {/* Title */}
                      <input
                        type="text"
                        value={a.t}
                        onChange={e => updateAchievement(idx, 't', e.target.value)}
                        placeholder="Achievement title…"
                        className="w-full px-3 py-2.5 border-2 border-slate-200 focus:border-[#3f51b5] rounded-xl
                                   text-sm text-[#1d2b4b] bg-white outline-none transition"
                      />

                      {/* Subtitle */}
                      <input
                        type="text"
                        value={a.s}
                        onChange={e => updateAchievement(idx, 's', e.target.value)}
                        placeholder="Event / description…"
                        className="w-full px-3 py-2.5 border-2 border-slate-200 focus:border-[#3f51b5] rounded-xl
                                   text-xs text-slate-500 bg-white outline-none transition"
                      />

                      {/* Icon + Color row */}
                      <div className="flex items-center gap-4 flex-wrap pt-1">

                        {/* Icon picker */}
                        <div className="relative">
                          <button
                            onClick={() => setShowIconPicker(showIconPicker === idx ? null : idx)}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-slate-200 bg-white
                                       text-xs font-semibold text-slate-500 cursor-pointer hover:border-[#3f51b5] transition"
                          >
                            <i className={`fas ${a.icon}`} style={{ color: a.color }} />
                            <span>Icon</span>
                            <i className="fas fa-chevron-down text-[9px]" />
                          </button>
                          {showIconPicker === idx && (
                            <div className="absolute top-10 left-0 z-10 bg-white border border-slate-200 rounded-xl
                                            shadow-xl p-2 grid grid-cols-5 gap-1 w-44">
                              {ACHIEVEMENT_ICON_OPTIONS.map(opt => (
                                <button
                                  key={opt.icon}
                                  onClick={() => { updateAchievement(idx, 'icon', opt.icon); setShowIconPicker(null); }}
                                  title={opt.label}
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm cursor-pointer transition border-none
                                    ${a.icon === opt.icon
                                      ? 'bg-indigo-50 border-2 border-[#3f51b5]'
                                      : 'bg-slate-50 hover:bg-slate-100'}`}
                                >
                                  <i className={`fas ${opt.icon}`} style={{ color: a.color }} />
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Color swatches */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {ACHIEVEMENT_COLOR_OPTIONS.map(c => (
                            <button
                              key={c}
                              onClick={() => updateAchievement(idx, 'color', c)}
                              className={`w-5 h-5 rounded-full cursor-pointer transition border-2 border-none
                                ${a.color === c ? 'ring-2 ring-[#1d2b4b] ring-offset-1 scale-110' : 'opacity-80 hover:opacity-100 hover:scale-110'}`}
                              style={{ backgroundColor: c }}
                              title={c}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add row */}
                <button
                  onClick={addAchievement}
                  className="w-full py-3 rounded-xl border-2 border-dashed border-slate-200 text-xs font-bold
                             text-slate-400 hover:border-[#3f51b5] hover:text-[#3f51b5] hover:bg-indigo-50/30
                             transition cursor-pointer mb-4 flex items-center justify-center gap-2 bg-transparent"
                >
                  <i className="fas fa-plus" /> Add Achievement
                </button>

<SaveButton onClick={saveAchievements} loading={achieveSaving} label="Save Achievements" loadingLabel="Saving..." icon="fa-award" />
              </>
            )}
          </Section>

          {/* 5. Change Password */}
          <Section id="password" icon="fa-lock" iconBg="bg-slate-100" iconColor="text-slate-600"
            title="Change Password" desc="Use a strong password with letters and numbers">
            <form onSubmit={handlePasswordChange} className="space-y-4">
              {pwErrors.general && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-red-600 text-xs flex items-center gap-2">
                  <i className="fas fa-triangle-exclamation shrink-0" /> {pwErrors.general}
                </div>
              )}

              {[
                { label: 'Current Password', field: 'current_password',      show: showCurrent, toggle: () => setShowCurrent(p => !p) },
                { label: 'New Password',      field: 'password',              show: showNew,     toggle: () => setShowNew(p => !p)     },
                { label: 'Confirm Password',  field: 'password_confirmation', show: showConfirm, toggle: () => setShowConfirm(p => !p) },
              ].map(({ label, field, show, toggle }) => (
                <div key={field}>
                  <label className="block text-xs font-bold text-[#1d2b4b] mb-1.5">{label}</label>
                  <div className="relative">
                    <input
                      type={show ? 'text' : 'password'}
                      value={pwForm[field]}
                      onChange={e => setPwForm(p => ({ ...p, [field]: e.target.value }))}
                      placeholder={`Enter ${label.toLowerCase()}`}
                      className={`w-full px-4 py-3 pr-11 border-2 rounded-xl text-sm outline-none transition
                        bg-slate-50 text-[#1d2b4b] focus:ring-4 focus:ring-[#3f51b5]/10
                        ${pwErrors[field] ? 'border-red-400 focus:border-red-400' : 'border-slate-200 focus:border-[#3f51b5]'}`}
                    />
                    <button type="button" onClick={toggle}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#3f51b5] transition border-none bg-transparent cursor-pointer">
                      <i className={`fas fa-${show ? 'eye-slash' : 'eye'} text-sm`} />
                    </button>
                  </div>
                  {pwErrors[field] && (
                    <p className="text-red-500 text-[11px] mt-1 flex items-center gap-1 m-0">
                      <i className="fas fa-circle-exclamation text-[10px]" /> {pwErrors[field]}
                    </p>
                  )}
                </div>
              ))}

              {pwForm.password && (
                <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 space-y-1.5">
                  {pwStrength.map(({ label, ok }) => (
                    <p key={label} className={`text-[11px] flex items-center gap-2 m-0 ${ok ? 'text-emerald-500' : 'text-slate-400'}`}>
                      <i className={`fas fa-${ok ? 'check-circle' : 'circle'} text-[10px]`} /> {label}
                    </p>
                  ))}
                </div>
              )}

<SaveButton type="submit" loading={loading} label="Change Password" loadingLabel="Saving..." icon="fa-lock" />
            </form>
          </Section>

          {/* Data Privacy Notice */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl px-5 py-4 flex items-start gap-3">
            <i className="fas fa-shield-alt text-[#3f51b5] mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-bold text-[#1d2b4b] mb-1 m-0">Data Privacy Notice</p>
              <p className="text-xs text-slate-500 leading-relaxed m-0">
                Your data is protected under <strong>Republic Act No. 10173</strong> (Data Privacy Act of 2012).
                Sinag-Bughaw is fully compliant with NU Lipa's data protection policies.
                You may request data deletion at any time by contacting the Data Privacy Officer.
              </p>
            </div>
          </div>

        </main>
      </div>

      <Footer />
    </div>
  );
}

// Reusable section card
function Section({ id, icon, iconBg, iconColor, title, desc, children }) {
  return (
    <section id={id} className="bg-white rounded-2xl p-6 sm:p-7 shadow-sm border border-slate-100 scroll-mt-24">
      <div className="flex items-center gap-3 mb-5">
        <div className={`w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
          <i className={`fas ${icon} ${iconColor} text-sm`} />
        </div>
        <div>
          <h2 className="text-sm font-black text-[#1d2b4b] m-0">{title}</h2>
          <p className="text-xs text-slate-400 m-0 mt-0.5">{desc}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

// Save button
function SaveButton({ onClick, label, loading = false, loadingLabel = 'Saving...', icon, type = 'button' }) {
  return (
    <button type={type} onClick={onClick} disabled={loading}
      className="w-auto px-6 py-2 rounded bg-amber-500 hover:bg-amber-400 text-white font-bold text-sm
                 border-none cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed
                 flex items-center justify-center gap-2">
      {loading ? <><i className="fas fa-spinner animate-spin" /> {loadingLabel}</> : <>{icon && <i className={`fas ${icon}`} />} {label}</>}
    </button>
  );
}
