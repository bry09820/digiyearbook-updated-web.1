import { useEffect } from 'react';

const SECTIONS = [
  {
    icon: 'fa-database',
    title: 'Data We Collect',
    color: 'bg-indigo-50 text-indigo-600',
    body: 'We collect your name, email address, student ID, course, profile photo, yearbook quote, and any content you upload, including gallery photos. This data is provided by you during registration and profile setup.',
  },
  {
    icon: 'fa-cogs',
    title: 'How We Use It',
    color: 'bg-violet-50 text-violet-600',
    body: 'Your data is used solely to power the Sinag-Bughaw Digital Yearbook — displaying your profile in the student directory, enabling messaging between users, and generating your yearbook page.',
  },
  {
    icon: 'fa-lock',
    title: 'Data Protection',
    color: 'bg-emerald-50 text-emerald-600',
    body: 'All data is stored on secure servers with encryption at rest and in transit. Profile photos are stored via Cloudinary with private access controls. Passwords are hashed using bcrypt and are never stored in plain text.',
  },
  {
    icon: 'fa-user-check',
    title: 'Your Rights',
    color: 'bg-sky-50 text-sky-600',
    body: 'Under RA 10173, you have the right to access, correct, erase, and port your data. You may also object to processing or withdraw consent at any time by contacting the Data Privacy Officer at dpo@nu-lipa.edu.ph.',
  },
  {
    icon: 'fa-share-alt',
    title: 'Data Sharing',
    color: 'bg-amber-50 text-amber-600',
    body: 'We do not sell your data to third parties. Data may be shared only with NU Lipa administrators for academic purposes, or with law enforcement when legally required.',
  },
];

export default function PrivacyModal({ isOpen, onClose }) {
  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <>
      <style>{`
        @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes slideUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-[#0e1628]/65 backdrop-blur-sm animate-[fadeIn_0.2s_ease]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Privacy Policy">
        <div className="bg-white w-full max-w-[560px] max-h-[88vh] rounded-[26px] flex flex-col overflow-hidden
                        shadow-[0_30px_80px_rgba(0,0,0,0.22)] animate-[slideUp_0.3s_ease]">

          {/* Header */}
          <div className="shrink-0 bg-gradient-to-br from-[#1d2b4b] to-[#3f51b5] px-7 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-[#fdb813]/15 border border-[#fdb813]/25 flex items-center justify-center shrink-0">
                  <i className="fas fa-shield-alt text-[#fdb813] text-base" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-white font-extrabold text-lg leading-none m-0">Privacy Policy</h2>
                  <p className="text-white/50 text-[10px] m-0 mt-1 leading-none">Republic Act No. 10173 — Data Privacy Act of 2012</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors border-none cursor-pointer shrink-0"
                aria-label="Close"
              >
                <i className="fas fa-times text-sm" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-7 py-6 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-slate-100 [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full">
            <p className="text-sm text-slate-500 leading-relaxed mb-5">
              This Privacy Policy explains how <strong className="text-[#1d2b4b]">National University Lipa</strong> collects, uses, and protects personal information
              through the <strong className="text-[#1d2b4b]">Sinag-Bughaw Digital Yearbook</strong> system, effective January 2026.
            </p>

            <div className="flex flex-col gap-3">
              {SECTIONS.map(({ icon, title, color, body }) => (
                <div key={title} className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
                      <i className={`fas ${icon} text-xs`} aria-hidden="true" />
                    </div>
                    <h4 className="text-[13px] font-bold text-[#1d2b4b] m-0">{title}</h4>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed m-0 pl-10">{body}</p>
                </div>
              ))}
            </div>

            {/* Footer note */}
            <div className="mt-5 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
              <p className="text-xs text-slate-500 m-0 leading-relaxed">
                <span className="font-semibold text-[#1d2b4b]">Last Updated:</span> January 2026 ·{' '}
                <span className="font-semibold text-[#1d2b4b]">Contact:</span> dpo@nu-lipa.edu.ph ·{' '}
                <span className="font-semibold text-[#1d2b4b]">NPC:</span> privacy.gov.ph
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="shrink-0 px-7 py-5 border-t border-slate-100 bg-white">
            <button
              onClick={onClose}
              className="w-full bg-[#1d2b4b] hover:bg-[#162038] text-white font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer border-none text-sm"
            >
              <i className="fas fa-check-circle" aria-hidden="true" />
              I Understand — Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}