import { Lock } from "lucide-react";
import { usePrivacyProtection } from "@/hooks/usePrivacyProtection";

export default function PrivacyScreen({ enabled = true }) {
  const hidden = usePrivacyProtection(enabled);
  if (!enabled) return null;

  return (
    <div
      id="sb-privacy-shield"
      aria-hidden={!hidden}
      className={[
        "fixed inset-0 z-[2147483647] grid place-items-center overflow-hidden bg-[#071633]",
        hidden ? "visible opacity-100 pointer-events-auto" : "invisible opacity-0 pointer-events-none",
      ].join(" ")}
    >
      <div
        className="absolute inset-0 bg-cover bg-center opacity-20"
        style={{ backgroundImage: "url('/images/NU-building.jpg')" }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(253,184,19,0.22),transparent_28%),linear-gradient(135deg,rgba(8,24,56,0.98),rgba(29,43,75,0.94)_48%,rgba(4,12,31,0.98))]" />
      <div className="absolute left-0 top-0 h-1.5 w-full bg-[#fdb813]" />

      <div className="relative flex w-[min(90vw,440px)] flex-col items-center text-center text-white">
        <div className="mb-6 flex items-center gap-3">
          <img src="/images/NU_logo.png" alt="NU Lipa" className="h-14 w-14 object-contain" />
          <div className="text-left">
            <p className="m-0 text-xs font-black uppercase tracking-[0.28em] text-[#fdb813]">Sinag-Bughaw</p>
            <p className="m-0 text-sm font-semibold text-white/75">National University Lipa</p>
          </div>
        </div>

        <div className="mb-5 grid h-20 w-20 place-items-center rounded-full border border-[#fdb813]/45 bg-white/10 shadow-[0_0_42px_rgba(253,184,19,0.22)]">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-[#fdb813] text-[#1d2b4b]">
            <Lock size={29} strokeWidth={3} />
          </div>
        </div>

        <p className="mb-2 text-xl font-black tracking-normal text-white">
          Content Hidden for Privacy Protection
        </p>
        <p className="max-w-sm text-sm font-medium leading-6 text-white/68">
          Your NU yearbook and personal information are protected while this screen is inactive.
        </p>
      </div>
    </div>
  );
}
