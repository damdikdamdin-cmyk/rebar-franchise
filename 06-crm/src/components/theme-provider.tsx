"use client";

import * as React from "react";
import { createContext, useContext, useEffect } from "react";
import { useLocalStorage } from "@/lib/use-local-storage";

type Theme = "dark" | "light" | "system";
const THEMES: Theme[] = ["dark", "light", "system"];

const ThemeProviderContext = createContext<{ theme: Theme; setTheme: (t: Theme) => void }>({
  theme: "light",
  setTheme: () => undefined,
});

export function ThemeProvider({
  children,
  defaultTheme = "light",
  storageKey = "rebar-os-theme",
}: {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}) {
  const [stored, setTheme] = useLocalStorage(storageKey);
  const theme: Theme = THEMES.includes(stored as Theme) ? (stored as Theme) : defaultTheme;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    const resolved =
      theme === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : theme;
    root.classList.add(resolved);
  }, [theme]);

  return (
    <ThemeProviderContext.Provider
      value={{ theme, setTheme }}
    >
      {children}
    </ThemeProviderContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeProviderContext);
}
