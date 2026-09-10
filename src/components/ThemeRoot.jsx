import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { createAppTheme, THEME_STORAGE_KEY } from "../theme";
import { isCapacitor } from "../api/platform";

const ColorModeContext = createContext({
  mode: "light",
  setMode: () => {},
});

export function useColorMode() {
  return useContext(ColorModeContext);
}

function readStoredMode() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    // ignore
  }
  const dark =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  const mode = dark ? "dark" : "light";
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // ignore
  }
  return mode;
}

export default function ThemeRoot({ children }) {
  const [mode, setModeState] = useState(() =>
    typeof window === "undefined" ? "light" : readStoredMode()
  );
  const theme = useMemo(() => createAppTheme(mode), [mode]);

  const setMode = (next) => {
    if (next !== "light" && next !== "dark") return;
    setModeState(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const root = document.documentElement;
    root.style.colorScheme = mode;
    root.dataset.theme = mode;
    root.classList.toggle("dark", mode === "dark");
    root.style.backgroundColor = theme.palette.background.default;
    document.body.style.backgroundColor = theme.palette.background.default;
  }, [mode, theme]);

  useEffect(() => {
    if (!isCapacitor()) return undefined;
    let cancelled = false;
    import("@capacitor/status-bar")
      .then(({ StatusBar, Style }) => {
        if (cancelled) return;
        StatusBar.setStyle({ style: mode === "dark" ? Style.Dark : Style.Light }).catch(() => {});
        if (StatusBar.setBackgroundColor) {
          StatusBar.setBackgroundColor({
            color: mode === "dark" ? "#0b1220" : "#1976d2",
          }).catch(() => {});
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [mode]);

  const value = useMemo(() => ({ mode, setMode }), [mode]);

  return (
    <ColorModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline enableColorScheme />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}
