import React from "react";
import { ToggleButton, ToggleButtonGroup } from "@mui/material";
import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import { useColorMode } from "./ThemeRoot";

export default function ThemeToggle({ variant = "default" }) {
  const { mode, setMode } = useColorMode();
  const onAppBar = variant === "appbar";

  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={mode}
      onChange={(_, value) => {
        if (value) setMode(value);
      }}
      aria-label="Color mode"
      sx={{
        mr: onAppBar ? 1 : 0,
        bgcolor: onAppBar ? "rgba(255,255,255,0.12)" : "action.hover",
        "& .MuiToggleButton-root": {
          color: onAppBar ? "inherit" : "text.secondary",
          borderColor: onAppBar ? "rgba(255,255,255,0.28)" : "divider",
          px: 1,
          py: 0.4,
          "&.Mui-selected": {
            bgcolor: onAppBar ? "rgba(255,255,255,0.28)" : "action.selected",
            color: onAppBar ? "inherit" : "text.primary",
            "&:hover": {
              bgcolor: onAppBar ? "rgba(255,255,255,0.36)" : "action.selected",
            },
          },
        },
      }}
    >
      <ToggleButton value="light" aria-label="Light mode">
        <LightModeIcon sx={{ fontSize: 18 }} />
      </ToggleButton>
      <ToggleButton value="dark" aria-label="Dark mode">
        <DarkModeIcon sx={{ fontSize: 18 }} />
      </ToggleButton>
    </ToggleButtonGroup>
  );
}
