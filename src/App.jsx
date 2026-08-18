import React, { useState, useEffect } from "react";
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  AppBar,
  Toolbar,
  Typography,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Box,
  IconButton,
  useMediaQuery,
  Button,
  CircularProgress,
} from "@mui/material";
import {
  Menu as MenuIcon,
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

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#1976d2",
    },
    secondary: {
      main: "#dc004e",
    },
  },
});

const DRAWER_WIDTH = 240;

const AppContent = () => {
  const [currentPage, setCurrentPage] = useState("customers");
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
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

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const menuItems = [
    { id: "customers", label: "Customers", icon: <PeopleIcon /> },
    { id: "sender", label: "Sender Details", icon: <PersonIcon /> },
    { id: "bookings", label: "Create Bookings", icon: <ShippingIcon /> },
    { id: "shipments", label: "Shipments", icon: <ReceiptLongIcon /> },
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
              if (isMobile) {
                setMobileOpen(false);
              }
            }}
          >
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} />
          </ListItem>
        ))}
      </List>
    </div>
  );

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "100vh",
          }}
        >
          <CircularProgress />
        </Box>
      </ThemeProvider>
    );
  }

  // ── Not authenticated ──────────────────────────────────────────────────────
  if (!user) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <LoginPage />
      </ThemeProvider>
    );
  }

  // ── Subscription gate (PUBLIC_MODE=true only) ─────────────────────────────
  // In PUBLIC_MODE=false this block is never reached because publicMode=false.
  // In PUBLIC_MODE=true, subscriptionValid is set by AuthContext after reading
  // the users/{uid} Firestore document.  If the document is missing or the
  // subscription has lapsed the user sees SubscriptionExpiredPage which lets
  // them re-check once they have subscribed/renewed.
  if (publicMode && !subscriptionValid) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <SubscriptionExpiredPage />
      </ThemeProvider>
    );
  }

  // ── PUDO API key gate (PUBLIC_MODE=true only) ──────────────────────────────
  // In PUBLIC_MODE=false the key is baked into config.PUDO_API_KEY at build time
  // so pudoApiKey is always set and this block is never reached.
  // In PUBLIC_MODE=true the key is stored per-user in Firestore.  New subscribers
  // who have not yet entered their key are directed to ApiKeySetupPage.
  if (publicMode && !pudoApiKey) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <ApiKeySetupPage />
      </ThemeProvider>
    );
  }

  // ── Main app ───────────────────────────────────────────────────────────────
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: "flex" }}>
        <AppBar
          position="fixed"
          sx={{
            width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
            ml: { md: `${DRAWER_WIDTH}px` },
          }}
        >
          <Toolbar>
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2, display: { md: "none" } }}
            >
              <MenuIcon />
            </IconButton>
            <Typography
              variant="h6"
              noWrap
              component="div"
              sx={{ flexGrow: 1 }}
            >
              {menuItems.find((item) => item.id === currentPage)?.label ||
                "Pudo Booking App"}
            </Typography>
            <Typography variant="body2" sx={{ mr: 2 }}>
              {user.email}
            </Typography>
            <Button
              color="inherit"
              onClick={handleSignOut}
              startIcon={<LogoutIcon />}
            >
              Sign Out
            </Button>
          </Toolbar>
        </AppBar>

        <Box
          component="nav"
          sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}
        >
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={handleDrawerToggle}
            ModalProps={{
              keepMounted: true,
            }}
            sx={{
              display: { xs: "block", md: "none" },
              "& .MuiDrawer-paper": {
                boxSizing: "border-box",
                width: DRAWER_WIDTH,
              },
            }}
          >
            {drawer}
          </Drawer>
          <Drawer
            variant="permanent"
            sx={{
              display: { xs: "none", md: "block" },
              "& .MuiDrawer-paper": {
                boxSizing: "border-box",
                width: DRAWER_WIDTH,
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
            mt: 8,
          }}
        >
          {renderPage()}
        </Box>
      </Box>
    </ThemeProvider>
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
