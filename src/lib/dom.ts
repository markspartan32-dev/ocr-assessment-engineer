/** Small DOM helpers for focus management and URL fragments (client-only). */

/** Focuses an element after React has committed the current update. */
export function focusSoon(target: string | (() => HTMLElement | null | undefined)) {
  requestAnimationFrame(() => {
    const el = typeof target === "string" ? document.getElementById(target) : target();
    el?.focus({ preventScroll: false });
  });
}

/** True when keyboard focus has been dropped (e.g. the focused element was removed). */
export function focusIsLost() {
  return !document.activeElement || document.activeElement === document.body;
}

/** The decoded URL fragment, or null when it is empty or malformed (e.g. "#%"). */
export function hashId(): string | null {
  const raw = window.location.hash.slice(1);
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}

const INTERACTIVE = "a[href], button, summary, input, select, textarea, [role=button], [role=link], [role=option], [role=radio], [contenteditable='true']";

/** Whether a key event started on a control that owns its own Space/Enter behaviour. */
export function isInteractiveTarget(target: EventTarget | null) {
  return target instanceof Element && target.closest(INTERACTIVE) !== null;
}
