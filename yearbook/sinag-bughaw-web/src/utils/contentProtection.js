import { useEffect, useRef } from 'react';

export function disableContextMenu(el) {
  if (!el) return;
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}

export function disableDrag(el) {
  if (!el) return;
  el.addEventListener('dragstart', (e) => e.preventDefault());
  el.setAttribute('draggable', 'false');
}

export function applyElementProtection(el) {
  if (!el) return;
  disableContextMenu(el);
  disableDrag(el);
  el.style.userSelect         = 'none';
  el.style.webkitUserSelect   = 'none';
  el.style.webkitTouchCallout = 'none';
}

const BLOCKED_CTRL = new Set(['s', 'u', 'p']);
const BLOCKED_CTRL_SHIFT = new Set(['i', 'j', 'c', 's']);

export function isCaptureShortcut(event) {
  const key = event.key ?? '';
  const code = event.code ?? '';
  const lower = key.toLowerCase();
  const printScreen = key === 'PrintScreen'
    || lower === 'printscreen'
    || code === 'PrintScreen'
    || event.keyCode === 44
    || event.which === 44;

  if (printScreen) return true;
  // Win+Shift+S opens the Windows snipping overlay.
  if (event.metaKey && event.shiftKey && (lower === 's' || code === 'KeyS')) return true;
  // Win+PrintScreen is already covered by printScreen, including Alt+PrintScreen.
  return false;
}

export function isScreenshotShortcut(event) {
  if (isCaptureShortcut(event)) return true;
  const key = event.key ?? '';
  const lower = key.toLowerCase();
  if (key === 'F12') return true;
  const modifier = event.ctrlKey || event.metaKey;
  if (modifier && event.shiftKey && BLOCKED_CTRL_SHIFT.has(lower)) return true;
  if (modifier && !event.shiftKey && BLOCKED_CTRL.has(lower)) return true;
  return false;
}

function isSensitiveMedia(target) {
  return Boolean(target?.closest?.('img, video, canvas, .protected-media-wrapper, [data-sensitive-media]'));
}

export function installKeyboardGuard(onBlocked) {
  const handler = (event) => {
    if (!isScreenshotShortcut(event)) return;
    event.preventDefault();
    onBlocked?.(event);
    if (isCaptureShortcut(event)) {
      window.dispatchEvent(new CustomEvent('sb-screenshot-attempt'));
    }
  };

  document.addEventListener('keydown', handler, true);
  document.addEventListener('keyup', handler, true);
  return () => {
    document.removeEventListener('keydown', handler, true);
    document.removeEventListener('keyup', handler, true);
  };
}

export function installMediaGuards() {
  const blockMenu = (event) => {
    if (!isSensitiveMedia(event.target)) return;
    event.preventDefault();
  };
  const blockDrag = (event) => {
    if (!isSensitiveMedia(event.target)) return;
    event.preventDefault();
  };

  document.addEventListener('contextmenu', blockMenu, true);
  document.addEventListener('dragstart', blockDrag, true);
  return () => {
    document.removeEventListener('contextmenu', blockMenu, true);
    document.removeEventListener('dragstart', blockDrag, true);
  };
}

export function useScreenshotGuards(enabled, onBlocked) {
  const onBlockedRef = useRef(onBlocked);
  onBlockedRef.current = onBlocked;

  useEffect(() => {
    if (!enabled) return undefined;
    const removeKeys = installKeyboardGuard((event) => onBlockedRef.current?.(event));
    const removeMedia = installMediaGuards();
    return () => {
      removeKeys();
      removeMedia();
    };
  }, [enabled]);
}

export function useContentProtection() {
  const ref = useRef(null);

  useEffect(() => {
    applyElementProtection(ref.current);
    const cleanup = installKeyboardGuard();
    return cleanup;
  }, []);

  return ref;
}

export const PROTECTION_CSS = `
  .protected-media-wrapper {
    -webkit-user-select: none;
    -moz-user-select: none;
    user-select: none;
    -webkit-touch-callout: none;
    position: relative;
  }
  .protected-media-wrapper .protected-media {
    pointer-events: none;
    display: block;
    width: 100%;
    -webkit-user-drag: none;
  }
  .protected-media-wrapper .media-shield {
    position: absolute;
    inset: 0;
    z-index: 2;
    cursor: default;
  }
  @media print {
    .protected-media-wrapper { display: none !important; }
    .print-blocked-notice { display: block !important; text-align: center; padding: 40px; font-weight: bold; color: #1d2b4b; }
  }
`;