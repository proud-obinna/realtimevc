import { create } from "zustand";

export const useThemeStore = create((set) => ({
  theme: localStorage.getItem("realtimevc-theme") || "forest",
  setTheme: (theme) => {
    localStorage.setItem("realtimevc-theme", theme);
    set({ theme });
  },
}));