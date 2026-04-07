import React from "react";
import { Box, Typography, Button, Paper } from "@mui/material";
import { ErrorOutline } from "@mui/icons-material";

/**
 * Catches unhandled React render errors and displays them instead of a blank
 * page. Press Cmd/Ctrl+Shift+I to open DevTools for full stack traces.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("React render error caught by ErrorBoundary:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "100vh",
            bgcolor: "#f5f5f5",
            p: 4,
          }}
        >
          <Paper sx={{ p: 4, maxWidth: 560, textAlign: "center" }} elevation={3}>
            <ErrorOutline sx={{ fontSize: 56, color: "error.main", mb: 2 }} />
            <Typography variant="h5" fontWeight={600} mb={1}>
              Something went wrong
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={2}>
              {this.state.error?.message || "An unexpected error occurred."}
            </Typography>
            <Typography variant="caption" color="text.disabled" display="block" mb={3}>
              Press Cmd+Shift+I (Mac) or Ctrl+Shift+I (Windows) to open DevTools for details.
            </Typography>
            <Button variant="contained" onClick={() => window.location.reload()}>
              Reload app
            </Button>
          </Paper>
        </Box>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
