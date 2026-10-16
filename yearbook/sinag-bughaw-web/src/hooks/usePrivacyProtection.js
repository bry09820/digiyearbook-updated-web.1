import { useEffect, useState } from "react";
import { isCaptureShortcut } from "@/utils/contentProtection";

const FILE_DIALOG_GRACE_MS = 30000;
const SHIELD_HOLD_MS = 1800;
const SHIELD_MIN_MS = 700;

function paintPrivacyShield(active) {
  document.body.classList.toggle("sb-privacy-hidden", active);
  const shield = document.getElementById("sb-privacy-shield");
  if (!shield) return;
  shield.style.transition = "none";
  shield.style.opacity = active ? "1" : "0";
  shield.style.pointerEvents = active ? "auto" : "none";
  shield.style.visibility = active ? "visible" : "hidden";
  shield.setAttribute("aria-hidden", active ? "false" : "true");
  if (active) void shield.offsetWidth;
}

export function usePrivacyProtection(enabled = true) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setHidden(false);
      document.body.classList.remove("sb-privacy-hidden");
      return undefined;
    }

    let fileDialogUntil = 0;
    let shortcutTimer = 0;
    let shieldUntil = 0;

    const isFileDialogActive = () => Date.now() < fileDialogUntil;
    const markFileDialogActive = () => {
      fileDialogUntil = Date.now() + FILE_DIALOG_GRACE_MS;
      setHidden(false);
    };
    const clearFileDialogActive = () => {
      fileDialogUntil = 0;
    };

    const hide = () => {
      if (isFileDialogActive()) return;
      paintPrivacyShield(true);
      setHidden(true);
    };
    const show = () => {
      clearFileDialogActive();
      if (Date.now() < shieldUntil) return;
      if (!document.hidden && document.hasFocus()) {
        paintPrivacyShield(false);
        setHidden(false);
      }
    };
    const hideForShortcut = () => {
      const now = Date.now();
      shieldUntil = Math.max(shieldUntil, now + SHIELD_HOLD_MS);
      paintPrivacyShield(true);
      setHidden(true);
      window.clearTimeout(shortcutTimer);
      shortcutTimer = window.setTimeout(show, SHIELD_HOLD_MS);
    };
    const resumeAfterInteraction = (event) => {
      if (event && isCaptureShortcut(event)) {
        hideForShortcut();
        return;
      }
      if (Date.now() < shieldUntil - (SHIELD_HOLD_MS - SHIELD_MIN_MS)) return;
      shieldUntil = 0;
      show();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) hide();
      else show();
    };
    const handleDocumentClick = (event) => {
      if (event.target?.matches?.('input[type="file"]')) {
        markFileDialogActive();
      }
    };
    const handleDocumentChange = (event) => {
      if (event.target?.matches?.('input[type="file"]')) {
        show();
      }
    };

    const handleShortcut = (event) => {
      if (!isCaptureShortcut(event)) return;
      event.preventDefault();
      hideForShortcut();
    };

    if (document.hidden) hide();

    document.addEventListener("click", handleDocumentClick, true);
    document.addEventListener("change", handleDocumentChange, true);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    const handleResumeKey = (event) => {
      if (isCaptureShortcut(event)) return;
      resumeAfterInteraction(event);
    };

    document.addEventListener("keydown", handleShortcut, true);
    document.addEventListener("keyup", handleShortcut, true);
    document.addEventListener("keydown", handleResumeKey, true);
    document.addEventListener("pointerdown", resumeAfterInteraction, true);
    window.addEventListener("sb-screenshot-attempt", hideForShortcut);
    window.addEventListener("blur", hide);
    window.addEventListener("focus", show);
    window.addEventListener("pagehide", hide);
    window.addEventListener("pageshow", show);

    return () => {
      window.clearTimeout(shortcutTimer);
      document.body.classList.remove("sb-privacy-hidden");
      document.removeEventListener("click", handleDocumentClick, true);
      document.removeEventListener("change", handleDocumentChange, true);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("keydown", handleShortcut, true);
      document.removeEventListener("keyup", handleShortcut, true);
      document.removeEventListener("keydown", handleResumeKey, true);
      document.removeEventListener("pointerdown", resumeAfterInteraction, true);
      window.removeEventListener("sb-screenshot-attempt", hideForShortcut);
      paintPrivacyShield(false);
      window.removeEventListener("blur", hide);
      window.removeEventListener("focus", show);
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("pageshow", show);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      paintPrivacyShield(false);
      return undefined;
    }
    paintPrivacyShield(hidden);
    return undefined;
  }, [enabled, hidden]);

  return hidden;
}
