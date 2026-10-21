/** Ephemeral UI state: command palette, Focus Mode and reward feedback. Not persisted. */

import { create } from "zustand";

export interface XpToast {
  id: number;
  amount: number;
  label: string;
}

interface UiState {
  paletteOpen: boolean;
  focusMode: boolean;
  /** Level reached, while the level-up celebration is showing. */
  levelUp: number | null;
  toasts: XpToast[];
  /** Text announced politely to screen readers. */
  announcement: string;
  setPaletteOpen: (open: boolean) => void;
  setFocusMode: (on: boolean) => void;
  toggleFocusMode: () => void;
  showLevelUp: (level: number) => void;
  dismissLevelUp: () => void;
  pushXp: (amount: number, label: string) => void;
  dropToast: (id: number) => void;
  announce: (message: string) => void;
}

let toastId = 0;
// Live regions only speak when their text changes, so alternate an invisible suffix to make a
// repeated message (e.g. two "+10 XP. Good" in a row) announce again.
let parity = false;
const fresh = (message: string) => {
  parity = !parity;
  return parity ? message : `${message}\u200B`;
};

export const useUi = create<UiState>()((set) => ({
  paletteOpen: false,
  focusMode: false,
  levelUp: null,
  toasts: [],
  announcement: "",
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  setFocusMode: (focusMode) => set({ focusMode }),
  toggleFocusMode: () => set((s) => ({ focusMode: !s.focusMode })),
  showLevelUp: (levelUp) => set({ levelUp }),
  dismissLevelUp: () => set({ levelUp: null }),
  pushXp: (amount, label) => {
    toastId += 1;
    const id = toastId;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, amount, label }], announcement: fresh(`+${amount} XP. ${label}`) }));
  },
  dropToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  announce: (announcement) => set({ announcement: fresh(announcement) }),
}));

/** Shows the feedback for a reward returned by a progress action. */
export function celebrate(reward: { xp: number; levelUp: number | null; goalReached: boolean }, label: string) {
  const ui = useUi.getState();
  if (reward.xp > 0) ui.pushXp(reward.xp, reward.goalReached ? `${label} · Daily goal complete!` : label);
  if (reward.levelUp) ui.showLevelUp(reward.levelUp);
}
