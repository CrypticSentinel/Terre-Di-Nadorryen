import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type ThemeStyle = "clean" | "parchment" | "dark";
export type ThemeAccent = "blue" | "amber" | "emerald" | "rose" | "violet";

interface ThemeContextValue {
  style: ThemeStyle;
  accent: ThemeAccent;
  setStyle: (s: ThemeStyle) => void;
  setAccent: (a: ThemeAccent) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STYLE_KEY = "tdn:theme-style";
const ACCENT_KEY = "tdn:theme-accent";

export const STYLE_OPTIONS: { value: ThemeStyle; label: string }[] = [
  { value: "clean", label: "Chiaro" },
  { value: "parchment", label: "Pergamena" },
  { value: "dark", label: "Scuro" },
];

export const ACCENT_OPTIONS: { value: ThemeAccent; label: string; preview: string }[] = [
  { value: "blue", label: "Blu", preview: "hsl(217 91% 55%)" },
  { value: "amber", label: "Ambra", preview: "hsl(38 92% 50%)" },
  { value: "emerald", label: "Smeraldo", preview: "hsl(160 84% 39%)" },
  { value: "rose", label: "Rosa", preview: "hsl(346 84% 56%)" },
  { value: "violet", label: "Viola", preview: "hsl(262 83% 58%)" },
];

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [style, setStyleState] = useState<ThemeStyle>(() => {
    if (typeof window === "undefined") return "clean";
    return (localStorage.getItem(STYLE_KEY) as ThemeStyle) || "clean";
  });
  const [accent, setAccentState] = useState<ThemeAccent>(() => {
    if (typeof window === "undefined") return "blue";
    return (localStorage.getItem(ACCENT_KEY) as ThemeAccent) || "blue";
  });

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.themeStyle = style;
    root.dataset.themeAccent = accent;
  }, [style, accent]);

  const setStyle = useCallback((s: ThemeStyle) => {
    setStyleState(s);
    try { localStorage.setItem(STYLE_KEY, s); } catch { /* noop */ }
  }, []);
  const setAccent = useCallback((a: ThemeAccent) => {
    setAccentState(a);
    try { localStorage.setItem(ACCENT_KEY, a); } catch { /* noop */ }
  }, []);

  const value = useMemo(() => ({ style, accent, setStyle, setAccent }), [style, accent, setStyle, setAccent]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
};
