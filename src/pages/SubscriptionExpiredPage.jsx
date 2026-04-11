import React, { useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Collapse,
} from "@mui/material";
import {
  CreditCard as CreditCardIcon,
  Refresh as RefreshIcon,
  Logout as LogoutIcon,
  OpenInNew as OpenInNewIcon,
  RocketLaunch as RocketLaunchIcon,
} from "@mui/icons-material";
import { useAuth } from "../contexts/AuthContext";

const HOMEPAGE_URL = "https://pudo-booking-pub.web.app";

export default function SubscriptionExpiredPage() {
  const { user, signOut, refreshProfile, userProfile } = useAuth();
  const isNewUser = userProfile === null;

  // Log the raw profile so developers can see what came back from Firestore
  // without having to open DevTools.
  React.useEffect(() => {
    console.log("[SubscriptionExpiredPage] userProfile:", userProfile);
    console.log("[SubscriptionExpiredPage] user uid:", user?.uid);
  }, [userProfile, user]);
  const [refreshing, setRefreshing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [showDebug, setShowDebug] = useState(false);

  const handleOpenHomepage = () => {
    try {
      const { shell } = window.require("electron");
      shell.openExternal(`${HOMEPAGE_URL}/signup`);
    } catch {
      window.open(`${HOMEPAGE_URL}/signup`, "_blank");
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshProfile();
    } catch (err) {
      console.error("Refresh error:", err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } catch (err) {
      console.error("Sign out error:", err);
    }
  };

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        bgcolor: "grey.50",
        p: 3,
      }}
    >
      <Card sx={{ maxWidth: 480, width: "100%", borderRadius: 3 }}>
        <CardContent sx={{ p: 5, textAlign: "center" }}>
          {/* Icon */}
          <Box
            sx={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              bgcolor: isNewUser ? "primary.50" : "error.50",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              mx: "auto",
              mb: 3,
            }}
          >
            {isNewUser ? (
              <RocketLaunchIcon sx={{ fontSize: 36, color: "primary.main" }} />
            ) : (
              <CreditCardIcon sx={{ fontSize: 36, color: "error.main" }} />
            )}
          </Box>

          <Typography variant="h5" fontWeight={700} gutterBottom>
            {isNewUser ? "Welcome to Pudo Booking!" : "Subscription inactive"}
          </Typography>

          <Typography color="text.secondary" sx={{ mb: 4, lineHeight: 1.7 }}>
            {isNewUser
              ? "Your account has been created. To start using the app, subscribe to activate your access."
              : "Your Pudo Booking subscription is no longer active. This may be because a payment failed or your subscription was cancelled."}
          </Typography>

          {!isNewUser && (
            <Alert severity="warning" sx={{ mb: 4, borderRadius: 2, textAlign: "left" }}>
              <Typography variant="body2">
                Access to the app is restricted until your subscription is renewed. Your data is
                safe and will be available as soon as your subscription is active again.
              </Typography>
            </Alert>
          )}

          {/* Actions */}
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Button
              variant="contained"
              size="large"
              startIcon={<OpenInNewIcon />}
              onClick={handleOpenHomepage}
              sx={{ borderRadius: 2, py: 1.5 }}
            >
              {isNewUser ? "Subscribe — R200/month" : "Renew subscription — R200/month"}
            </Button>

            <Button
              variant="outlined"
              size="large"
              startIcon={
                refreshing ? (
                  <CircularProgress size={16} color="inherit" />
                ) : (
                  <RefreshIcon />
                )
              }
              onClick={handleRefresh}
              disabled={refreshing}
              sx={{ borderRadius: 2, py: 1.5 }}
            >
              {refreshing ? "Checking…" : isNewUser ? "I've subscribed — check again" : "I've renewed — check again"}
            </Button>

            <Button
              variant="text"
              size="medium"
              startIcon={
                signingOut ? <CircularProgress size={14} color="inherit" /> : <LogoutIcon />
              }
              onClick={handleSignOut}
              disabled={signingOut}
              color="inherit"
              sx={{ color: "text.secondary" }}
            >
              Sign out
            </Button>
          </Box>

          {user?.email && (
            <Typography variant="caption" color="text.disabled" sx={{ mt: 3, display: "block" }}>
              Signed in as {user.email}
            </Typography>
          )}

          {/* Diagnostic panel — helps identify Firestore data issues */}
          <Box sx={{ mt: 2 }}>
            <Button
              size="small"
              variant="text"
              onClick={() => setShowDebug((v) => !v)}
              sx={{ color: "text.disabled", fontSize: "0.7rem" }}
            >
              {showDebug ? "Hide diagnostics" : "Show diagnostics"}
            </Button>
            <Collapse in={showDebug}>
              <Box
                sx={{
                  mt: 1,
                  p: 2,
                  bgcolor: "grey.100",
                  borderRadius: 1,
                  textAlign: "left",
                  fontSize: "0.7rem",
                  fontFamily: "monospace",
                  wordBreak: "break-all",
                }}
              >
                <Typography variant="caption" component="div" sx={{ fontWeight: 700, mb: 0.5 }}>
                  Firebase uid: {user?.uid ?? "—"}
                </Typography>
                <Typography variant="caption" component="div" sx={{ fontWeight: 700, mb: 0.5 }}>
                  Firestore users/&#123;uid&#125; document:
                </Typography>
                <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: "inherit" }}>
                  {userProfile === null
                    ? "null — document does not exist"
                    : JSON.stringify(userProfile, null, 2)}
                </pre>
              </Box>
            </Collapse>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
