"use client";

import { useEffect } from "react";
import { useProgress } from "@/store/progress";
import { useUi } from "@/store/ui";

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

/**
 * Cmd/Ctrl+K opens the palette; Shift+F toggles Focus mode (a character-key shortcut, so it can
 * be turned off in Settings, WCAG 2.1.4); Esc leaves Focus mode.
 */
export function GlobalShortcuts() {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const ui = useUi.getState();
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        ui.setPaletteOpen(!ui.paletteOpen);
        return;
      }
      if (ui.paletteOpen || ui.levelUp !== null || event.defaultPrevented) return;
      const shortcuts = useProgress.getState().settings.shortcuts;
      if (shortcuts && event.key === "F" && event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey && !isTyping(event.target)) {
        event.preventDefault();
        ui.toggleFocusMode();
      } else if (event.key === "Escape" && ui.focusMode && !document.querySelector("[role=dialog]")) {
        ui.setFocusMode(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return null;
}
