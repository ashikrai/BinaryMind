import { create } from "zustand";
import { localStore } from "@/storage/localStore";
import { STORAGE_KEYS } from "@/constants";

type Theme = "light" | "dark" | "system";

interface ThemeState {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

function apply(theme: Theme) {
  if (typeof document === "undefined") return;
  const resolved =
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

const initial = (localStore.get<Theme>(STORAGE_KEYS.theme) ?? "system") as Theme;

export const useTheme = create<ThemeState>((set) => ({
  theme: initial,
  setTheme: (theme) => {
    localStore.set(STORAGE_KEYS.theme, theme);
    apply(theme);
    set({ theme });
  },
}));

// Apply on load and react to system changes when theme === "system".
if (typeof window !== "undefined") {
  apply(initial);
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (useTheme.getState().theme === "system") apply("system");
  });
}
