import React, { useState, useEffect } from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Box,
  useMediaQuery,
  Button,
  CircularProgress,
  BottomNavigation,
  BottomNavigationAction,
  Paper,
} from "@mui/material";
import {
  People as PeopleIcon,
  Person as PersonIcon,
  LocalShipping as ShippingIcon,
  ReceiptLong as ReceiptLongIcon,
  Logout as LogoutIcon,
} from "@mui/icons-material";
import CustomersPage from "./pages/CustomersPage.jsx";
import SenderPage from "./pages/SenderPage.jsx";
import BookingsPage from "./pages/BookingsPage.jsx";
import ShipmentsPage from "./pages/ShipmentsPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import ApiKeySetupPage from "./pages/ApiKeySetupPage.jsx";
import SubscriptionExpiredPage from "./pages/SubscriptionExpiredPage.jsx";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { analytics } from "./firebase/analytics";
import ThemeToggle from "./components/ThemeToggle.jsx";

const DRAWER_WIDTH = 240;

const AppContent = () => {
  const [currentPage, setCurrentPage] = useState("customers");
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down("md"));
  const { user, signOut, loading, subscriptionValid, pudoApiKey, publicMode } = useAuth();

  useEffect(() => {
    if (loading) {
      analytics.screen("loading");
      return;
    }
    if (!user) {
      analytics.screen("login");
      return;
    }
    if (publicMode && !subscriptionValid) {
      analytics.screen("subscription_expired");
      return;
    }
    if (publicMode && !pudoApiKey) {
      analytics.screen("api_key_setup");
      return;
    }
    analytics.screen(currentPage);
  }, [loading, user, publicMode, subscriptionValid, pudoApiKey, currentPage]);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const menuItems = [
    { id: "customers", label: "Customers", shortLabel: "Customers", icon: <PeopleIcon /> },
    { id: "sender", label: "Sender Details", shortLabel: "Sender", icon: <PersonIcon /> },
    { id: "bookings", label: "Create Bookings", shortLabel: "Bookings", icon: <ShippingIcon /> },
    { id: "shipments", label: "Shipments", shortLabel: "Shipments", icon: <ReceiptLongIcon /> },
  ];

  const renderPage = () => {
    switch (currentPage) {
      case "customers":
        return <CustomersPage />;
      case "sender":
        return <SenderPage />;
      case "bookings":
        return <BookingsPage />;
      case "shipments":
        return <ShipmentsPage />;
      default:
        return <CustomersPage />;
    }
  };

  const drawer = (
    <div>
      <Toolbar>
        <Typography variant="h6" noWrap component="div">
          Pudo Booking
        </Typography>
      </Toolbar>
      <List>
        {menuItems.map((item) => (
          <ListItem
            button
            key={item.id}
            selected={currentPage === item.id}
            onClick={() => {
              setCurrentPage(item.id);
            }}
          >
            <ListItemIcon
              sx={{
                color: currentPage === item.id ? "primary.main" : "text.secondary",
              }}
            >
              {item.icon}
            </ListItemIcon>
            <ListItemText primary={item.label} />
          </ListItem>
        ))}
      </List>
    </div>
  );

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          bgcolor: "background.default",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  // ── Not authenticated ──────────────────────────────────────────────────────
  if (!user) {
    return <LoginPage />;
  }

  // ── Subscription gate (PUBLIC_MODE=true only) ─────────────────────────────
  // In PUBLIC_MODE=false this block is never reached because publicMode=false.
  // In PUBLIC_MODE=true, subscriptionValid is set by AuthContext after reading
  // the users/{uid} Firestore document.  If the document is missing or the
  // subscription has lapsed the user sees SubscriptionExpiredPage which lets
  // them re-check once they have subscribed/renewed.
  if (publicMode && !subscriptionValid) {
    return <SubscriptionExpiredPage />;
  }

  // ── PUDO API key gate (PUBLIC_MODE=true only) ──────────────────────────────
  // In PUBLIC_MODE=false the key is baked into config.PUDO_API_KEY at build time
  // so pudoApiKey is always set and this block is never reached.
  // In PUBLIC_MODE=true the key is stored per-user in Firestore.  New subscribers
  // who have not yet entered their key are directed to ApiKeySetupPage.
  if (publicMode && !pudoApiKey) {
    return <ApiKeySetupPage />;
  }

  // ── Main app ───────────────────────────────────────────────────────────────
  return (
      <Box sx={{ display: "flex", minHeight: "100dvh", bgcolor: "background.default" }}>
        <AppBar
          position="fixed"
          sx={{
            width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
            ml: { md: `${DRAWER_WIDTH}px` },
            pt: "env(safe-area-inset-top)",
          }}
        >
          <Toolbar>
            <Typography
              variant="h6"
              noWrap
              component="div"
              sx={{ flexGrow: 1 }}
            >
              {menuItems.find((item) => item.id === currentPage)?.label ||
                "Pudo Booking App"}
            </Typography>
            {!isMobile && (
              <Typography variant="body2" sx={{ mr: 2 }}>
                {user.email}
              </Typography>
            )}
            <ThemeToggle variant="appbar" />
            <Button
              color="inherit"
              onClick={handleSignOut}
              startIcon={<LogoutIcon />}
              size={isMobile ? "small" : "medium"}
            >
              {isMobile ? "Out" : "Sign Out"}
            </Button>
          </Toolbar>
        </AppBar>

        <Box
          component="nav"
          sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}
        >
          <Drawer
            variant="permanent"
            sx={{
              display: { xs: "none", md: "block" },
              "& .MuiDrawer-paper": {
                boxSizing: "border-box",
                width: DRAWER_WIDTH,
                bgcolor: "background.paper",
              },
            }}
            open
          >
            {drawer}
          </Drawer>
        </Box>

        <Box
          component="main"
          sx={{
            flexGrow: 1,
            width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
            mt: { xs: "calc(56px + env(safe-area-inset-top))", md: 8 },
            mb: { xs: "calc(56px + env(safe-area-inset-bottom))", md: 0 },
            bgcolor: "background.default",
            minHeight: 0,
          }}
        >
          {renderPage()}
        </Box>

        {isMobile && (
          <Paper
            elevation={8}
            sx={{
              position: "fixed",
              left: 0,
              right: 0,
              bottom: 0,
              pb: "env(safe-area-inset-bottom)",
              zIndex: (t) => t.zIndex.appBar,
            }}
          >
            <BottomNavigation
              showLabels
              value={currentPage}
              onChange={(_, value) => setCurrentPage(value)}
            >
              {menuItems.map((item) => (
                <BottomNavigationAction
                  key={item.id}
                  label={item.shortLabel}
                  value={item.id}
                  icon={item.icon}
                />
              ))}
            </BottomNavigation>
          </Paper>
        )}
      </Box>
    );
};

const App = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
