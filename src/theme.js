import { createTheme } from "@mui/material/styles";

const LIGHT = {
  background: { default: "#f8fafc", paper: "#ffffff" },
  text: { primary: "#0f172a", secondary: "#475569" },
};

const DARK = {
  background: { default: "#0b1220", paper: "#111827" },
  text: { primary: "#f1f5f9", secondary: "#94a3b8" },
};

const chipFilled = (bg, fg, border) => ({
  backgroundColor: bg,
  color: fg,
  border: `1px solid ${border}`,
  fontWeight: 600,
});

export const THEME_STORAGE_KEY = "pudo-theme";

export function createAppTheme(mode) {
  const isDark = mode === "dark";
  const surfaces = isDark ? DARK : LIGHT;

  return createTheme({
    palette: {
      mode,
      primary: {
        main: "#1976d2",
        light: "#42a5f5",
        dark: "#1565c0",
        contrastText: "#ffffff",
      },
      secondary: {
        main: isDark ? "#f48fb1" : "#dc004e",
      },
      success: {
        main: isDark ? "#4ade80" : "#2e7d32",
        contrastText: isDark ? "#052e16" : "#ffffff",
      },
      error: {
        main: isDark ? "#f87171" : "#d32f2f",
        contrastText: isDark ? "#450a0a" : "#ffffff",
      },
      warning: {
        main: isDark ? "#fbbf24" : "#ed6c02",
        contrastText: isDark ? "#422006" : "#ffffff",
      },
      info: {
        main: isDark ? "#38bdf8" : "#0288d1",
        contrastText: isDark ? "#082f49" : "#ffffff",
      },
      background: surfaces.background,
      text: surfaces.text,
      divider: isDark ? "rgba(148, 163, 184, 0.16)" : "rgba(15, 23, 42, 0.12)",
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          html: {
            colorScheme: mode,
          },
          body: {
            backgroundColor: surfaces.background.default,
            color: surfaces.text.primary,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundImage: "none",
            borderRight: `1px solid ${isDark ? "rgba(148, 163, 184, 0.16)" : "rgba(15, 23, 42, 0.08)"}`,
          },
        },
      },
      MuiListItem: {
        styleOverrides: {
          root: {
            "&.Mui-selected": {
              backgroundColor: isDark ? "rgba(25, 118, 210, 0.24)" : "rgba(25, 118, 210, 0.12)",
              "&:hover": {
                backgroundColor: isDark ? "rgba(25, 118, 210, 0.32)" : "rgba(25, 118, 210, 0.16)",
              },
            },
          },
        },
      },
      MuiBottomNavigation: {
        styleOverrides: {
          root: {
            backgroundColor: surfaces.background.paper,
            borderTop: `1px solid ${isDark ? "rgba(148, 163, 184, 0.16)" : "rgba(15, 23, 42, 0.08)"}`,
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            backgroundImage: "none",
          },
        },
      },
      MuiDataGrid: {
        styleOverrides: {
          root: {
            border: "none",
            backgroundColor: surfaces.background.paper,
            "--DataGrid-containerBackground": surfaces.background.paper,
            "& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within, & .MuiDataGrid-columnHeader:focus, & .MuiDataGrid-columnHeader:focus-within":
              {
                outline: "none",
              },
          },
          columnHeaders: {
            backgroundColor: isDark ? "#1e293b" : "#f1f5f9",
          },
          footerContainer: {
            borderTop: `1px solid ${isDark ? "rgba(148, 163, 184, 0.16)" : "rgba(15, 23, 42, 0.08)"}`,
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            fontWeight: 600,
            ...(isDark
              ? {
                  "&.MuiChip-filled": {
                    backgroundImage: "none",
                  },
                  "&.MuiChip-filled.MuiChip-colorDefault": chipFilled(
                    "rgba(148, 163, 184, 0.16)",
                    "#e2e8f0",
                    "rgba(148, 163, 184, 0.32)"
                  ),
                  "&.MuiChip-filled.MuiChip-colorPrimary": chipFilled(
                    "rgba(56, 189, 248, 0.16)",
                    "#7dd3fc",
                    "rgba(56, 189, 248, 0.35)"
                  ),
                  "&.MuiChip-filled.MuiChip-colorSecondary": chipFilled(
                    "rgba(244, 143, 177, 0.16)",
                    "#f9a8d4",
                    "rgba(244, 143, 177, 0.35)"
                  ),
                  "&.MuiChip-filled.MuiChip-colorSuccess": chipFilled(
                    "rgba(74, 222, 128, 0.16)",
                    "#86efac",
                    "rgba(74, 222, 128, 0.38)"
                  ),
                  "&.MuiChip-filled.MuiChip-colorError": chipFilled(
                    "rgba(248, 113, 113, 0.16)",
                    "#fca5a5",
                    "rgba(248, 113, 113, 0.38)"
                  ),
                  "&.MuiChip-filled.MuiChip-colorWarning": chipFilled(
                    "rgba(251, 191, 36, 0.16)",
                    "#fcd34d",
                    "rgba(251, 191, 36, 0.38)"
                  ),
                  "&.MuiChip-filled.MuiChip-colorInfo": chipFilled(
                    "rgba(56, 189, 248, 0.16)",
                    "#7dd3fc",
                    "rgba(56, 189, 248, 0.35)"
                  ),
                  "&.MuiChip-outlined": {
                    backgroundColor: "transparent",
                  },
                  "&.MuiChip-outlined.MuiChip-colorDefault": {
                    color: "#cbd5e1",
                    borderColor: "rgba(148, 163, 184, 0.4)",
                  },
                  "&.MuiChip-outlined.MuiChip-colorSuccess": {
                    color: "#86efac",
                    borderColor: "rgba(74, 222, 128, 0.5)",
                  },
                  "&.MuiChip-outlined.MuiChip-colorError": {
                    color: "#fca5a5",
                    borderColor: "rgba(248, 113, 113, 0.5)",
                  },
                  "&.MuiChip-outlined.MuiChip-colorWarning": {
                    color: "#fcd34d",
                    borderColor: "rgba(251, 191, 36, 0.5)",
                  },
                  "&.MuiChip-outlined.MuiChip-colorInfo": {
                    color: "#7dd3fc",
                    borderColor: "rgba(56, 189, 248, 0.5)",
                  },
                  "&.MuiChip-outlined.MuiChip-colorPrimary": {
                    color: "#7dd3fc",
                    borderColor: "rgba(56, 189, 248, 0.5)",
                  },
                }
              : {}),
          },
        },
      },
    },
  });
}
