import React, { useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Link,
  Divider,
  InputAdornment,
  IconButton,
  CircularProgress,
} from "@mui/material";
import {
  Key as KeyIcon,
  Visibility,
  VisibilityOff,
  OpenInNew as OpenInNewIcon,
  CheckCircle as CheckCircleIcon,
  Logout as LogoutIcon,
} from "@mui/icons-material";
import { useAuth } from "../contexts/AuthContext";

const PUDO_PORTAL_URL = "https://app.pudo.co.za";

const instructions = [
  {
    label: "Log in to the PUDO business portal",
    description: (
      <>
        Go to{" "}
        <Link href={PUDO_PORTAL_URL} target="_blank" rel="noopener noreferrer">
          app.pudo.co.za <OpenInNewIcon sx={{ fontSize: 12, verticalAlign: "middle" }} />
        </Link>{" "}
        and sign in with your PUDO business account. If you don&apos;t have one yet, register for a
        free PUDO business account on that page first.
      </>
    ),
  },
  {
    label: 'Open Settings → API',
    description:
      'Once logged in, click on your account name in the top right, then select "Settings". Navigate to the "API" or "Integrations" section.',
  },
  {
    label: "Copy your API key",
    description:
      'You will see your API key listed. Click "Copy" or select and copy the key. It will look like a long string of characters with a pipe (|) separator.',
  },
  {
    label: "Paste it below and save",
    description:
      "Paste the key into the field below and click Save. Your key is stored securely and only used to communicate with the PUDO API on your behalf.",
  },
];

export default function ApiKeySetupPage() {
  const { user, updatePudoApiKey, signOut } = useAuth();
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSave = async () => {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      setError("Please enter your PUDO API key.");
      return;
    }
    if (trimmed.length < 10) {
      setError("This doesn't look like a valid PUDO API key. Please check and try again.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await updatePudoApiKey(user.uid, trimmed);
      setSuccess(true);
    } catch (err) {
      setError("Failed to save API key. Please try again.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err) {
      console.error("Sign out error:", err);
    }
  };

  if (success) {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          bgcolor: "grey.50",
          p: 2,
        }}
      >
        <Card sx={{ maxWidth: 440, width: "100%", borderRadius: 3, textAlign: "center", p: 2 }}>
          <CardContent>
            <CheckCircleIcon sx={{ fontSize: 56, color: "success.main", mb: 2 }} />
            <Typography variant="h5" fontWeight={700} gutterBottom>
              API key saved!
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
              Your PUDO API key has been saved. The app is now ready to use.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              The app will reload now…
            </Typography>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        minHeight: "100vh",
        bgcolor: "grey.50",
        p: 3,
        pt: 6,
      }}
    >
      <Box sx={{ maxWidth: 600, width: "100%" }}>
        {/* Header */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 4 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2,
                bgcolor: "primary.main",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <KeyIcon sx={{ color: "white", fontSize: 22 }} />
            </Box>
            <Typography variant="h6" fontWeight={700}>
              Pudo Booking
            </Typography>
          </Box>
          <Button
            size="small"
            color="inherit"
            startIcon={<LogoutIcon />}
            onClick={handleSignOut}
            sx={{ color: "text.secondary" }}
          >
            Sign out
          </Button>
        </Box>

        <Card sx={{ borderRadius: 3, mb: 3 }}>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h5" fontWeight={700} gutterBottom>
              Connect your PUDO account
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 4 }}>
              To start creating shipments, you need to enter your PUDO API key. Follow the steps
              below to find it.
            </Typography>

            <Alert severity="info" sx={{ mb: 4, borderRadius: 2 }}>
              <Typography variant="body2">
                Your API key is stored securely in your account and is only used to make shipment
                requests to the PUDO API on your behalf.
              </Typography>
            </Alert>

            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
              How to find your PUDO API key
            </Typography>

            <Stepper orientation="vertical" nonLinear sx={{ mb: 4 }}>
              {instructions.map((step, index) => (
                <Step key={step.label} active>
                  <StepLabel
                    StepIconProps={{
                      sx: { color: "primary.main" },
                    }}
                  >
                    <Typography variant="body2" fontWeight={600}>
                      {step.label}
                    </Typography>
                  </StepLabel>
                  <StepContent>
                    <Typography variant="body2" color="text.secondary" sx={{ pb: 1 }}>
                      {step.description}
                    </Typography>
                  </StepContent>
                </Step>
              ))}
            </Stepper>

            <Divider sx={{ my: 3 }} />

            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
              Enter your API key
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                {error}
              </Alert>
            )}

            <TextField
              fullWidth
              label="PUDO API Key"
              placeholder="e.g. 12345678|AbCdEfGhIjKlMnOpQrStUv..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              type={showKey ? "text" : "password"}
              variant="outlined"
              sx={{ mb: 3 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <KeyIcon color="action" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowKey(!showKey)} edge="end">
                      {showKey ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
              }}
            />

            <Button
              fullWidth
              variant="contained"
              size="large"
              onClick={handleSave}
              disabled={saving || !apiKey.trim()}
              sx={{ borderRadius: 2, py: 1.5 }}
            >
              {saving ? (
                <>
                  <CircularProgress size={18} sx={{ mr: 1, color: "inherit" }} />
                  Saving…
                </>
              ) : (
                "Save API key and continue"
              )}
            </Button>
          </CardContent>
        </Card>

        <Typography variant="caption" color="text.secondary" align="center" display="block">
          Signed in as {user?.email} ·{" "}
          <Link component="button" variant="caption" onClick={handleSignOut}>
            Sign out
          </Link>
        </Typography>
      </Box>
    </Box>
  );
}
