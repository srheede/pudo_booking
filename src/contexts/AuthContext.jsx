/**
 * AuthContext — authentication and subscription state for the entire app.
 *
 * ── Two build modes ───────────────────────────────────────────────────────────
 *
 *  PUBLIC_MODE = false  (INTERNAL build)
 *    • Firebase Auth is still used so the developer has a login screen, but
 *      subscription checks are SKIPPED completely.
 *    • loadUserProfile() returns early without reading Firestore.
 *    • subscriptionValid stays false, but App.jsx only gates on
 *      (publicMode && !subscriptionValid) so the app is always accessible.
 *    • pudoApiKey comes from config.PUDO_API_KEY (baked in at build time).
 *
 *  PUBLIC_MODE = true  (PUBLIC / SUBSCRIPTION build)
 *    • Every login triggers a Firestore read of users/{uid} (in the named
 *      database configured for the public project).
 *    • isSubscriptionValid() checks subscriptionStatus, subscriptionEndDate.
 *    • If the subscription is invalid the user sees SubscriptionExpiredPage.
 *    • pudoApiKey is stored in the users/{uid} Firestore document and set in
 *      the Electron main process via IPC so API calls work immediately.
 *    • refreshProfile() lets the user re-check after subscribing/renewing.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { authService, userProfileService } from "../firebase/services";
import config from "../../config.json";

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

// ── Subscription tier limits (PUBLIC_MODE only) ───────────────────────────────
// null means unlimited.  Tiers are stored on the users/{uid} Firestore document
// as subscriptionTier.  Users without a tier field default to "professional"
// for backwards compatibility with early subscribers.
export const TIER_LIMITS = {
  starter:      { maxCustomers: 20,  maxMonthlyBookings: 50 },
  professional: { maxCustomers: 200, maxMonthlyBookings: 500 },
  enterprise:   { maxCustomers: null, maxMonthlyBookings: null },
};

const DEFAULT_TIER = "professional";

// ── Subscription validation (PUBLIC_MODE only) ────────────────────────────────
// Reads the users/{uid} Firestore document and checks:
//   1. subscriptionStatus === "active"
//   2. subscriptionEndDate exists and is in the future
const isSubscriptionValid = (profileData) => {
  if (!profileData) return false;
  if (profileData.subscriptionStatus !== "active") return false;
  if (!profileData.subscriptionEndDate) return false;
  // Firestore Timestamps have a .seconds property; plain ISO strings do not.
  const endDate = profileData.subscriptionEndDate.seconds
    ? new Date(profileData.subscriptionEndDate.seconds * 1000)
    : new Date(profileData.subscriptionEndDate);
  if (endDate <= new Date()) return false;
  return true;
};

// ── Electron IPC helper (PUBLIC_MODE only) ────────────────────────────────────
// Sends the user's PUDO API key to the Electron main process so it can be used
// in API calls made outside the renderer (e.g. from main.js).
// Silently no-ops when running in a non-Electron context (dev server / browser).
const notifyMainProcessApiKey = async (apiKey) => {
  try {
    const { ipcRenderer } = window.require("electron");
    await ipcRenderer.invoke("set-pudo-api-key", apiKey);
  } catch {
    // Not in Electron context (dev/browser preview) — silently ignore.
  }
};

// ─────────────────────────────────────────────────────────────────────────────

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // subscriptionValid and userProfile are only meaningful in PUBLIC_MODE=true.
  // In internal mode they remain at their initial values and are never checked.
  const [subscriptionValid, setSubscriptionValid] = useState(false);
  const [subscriptionTier, setSubscriptionTier] = useState(DEFAULT_TIER);
  const [pudoApiKey, setPudoApiKey] = useState(null);

  // undefined  = profile not yet loaded (initial / loading state)
  // null       = document does not exist in Firestore (new or unsubscribed user)
  // object     = document loaded successfully
  const [userProfile, setUserProfile] = useState(undefined);

  // ── Profile loader (PUBLIC_MODE=true only) ──────────────────────────────────
  // Reads users/{uid} from the PUBLIC project's Firestore database, validates
  // the subscription, and wires up the PUDO API key.
  // In PUBLIC_MODE=false this is a no-op — no Firestore reads are ever made.
  const loadUserProfile = useCallback(async (firebaseUser) => {
    if (!config.PUBLIC_MODE || !firebaseUser) return;

    let profile;
    try {
      profile = await userProfileService.get(firebaseUser.uid);
    } catch (err) {
      // A read error (e.g. wrong database, network failure) should never leave
      // the user stuck on the loading spinner.  Treat it as a missing profile
      // so the subscription page is shown.
      console.error("[Auth] Failed to read Firestore user document:", err);
      profile = null;
    }
    setUserProfile(profile);

    const valid = isSubscriptionValid(profile);
    setSubscriptionValid(valid);

    const tier = TIER_LIMITS[profile?.subscriptionTier] ? profile.subscriptionTier : DEFAULT_TIER;
    setSubscriptionTier(tier);

    const key = profile?.pudoApiKey ?? null;
    if (key) {
      // Notify the main process BEFORE updating React state so that when child
      // components mount and call the PUDO API, the key is already available.
      await notifyMainProcessApiKey(key);
    }
    setPudoApiKey(key);
  }, []);

  // ── Auth state listener ─────────────────────────────────────────────────────
  useEffect(() => {
    // Safety net: if Firebase Auth never fires (e.g. offline / blocked), stop
    // showing the loading screen after 8 seconds so the login page appears.
    const timeout = setTimeout(() => setLoading(false), 8000);

    const unsubscribe = authService.onAuthStateChanged(async (firebaseUser) => {
      clearTimeout(timeout);
      setUser(firebaseUser);
      if (firebaseUser) {
        // PUBLIC_MODE=true : loads the Firestore profile and validates subscription.
        // PUBLIC_MODE=false: loadUserProfile is a no-op; app proceeds directly.
        await loadUserProfile(firebaseUser);
      } else {
        // User signed out — clear all subscription state.
        setSubscriptionValid(false);
        setPudoApiKey(null);
        setUserProfile(undefined);
      }
      setLoading(false);
    });

    return () => {
      clearTimeout(timeout);
      unsubscribe();
    };
  }, [loadUserProfile]);

  // ── Periodic subscription re-validation (PUBLIC_MODE=true only) ──────────────
  // Re-reads the Firestore profile once per day so that a subscription
  // which expires at midnight is caught even if the app is never closed.
  // When the subscription becomes invalid, App.jsx's gate renders
  // SubscriptionExpiredPage automatically.
  useEffect(() => {
    if (!config.PUBLIC_MODE || !user) return;

    const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
    const intervalId = setInterval(() => {
      loadUserProfile(user);
    }, INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [user, loadUserProfile]);

  // ── Auth actions ─────────────────────────────────────────────────────────────

  const signUp = async (email, password) => {
    return authService.signUp(email, password);
  };

  const signIn = async (email, password) => {
    return authService.signIn(email, password);
  };

  const signOut = async () => {
    await authService.signOut();
    setSubscriptionValid(false);
    setSubscriptionTier(DEFAULT_TIER);
    setPudoApiKey(null);
  };

  // Saves a new PUDO API key to Firestore and notifies the main process.
  // Called by ApiKeySetupPage after the user enters their key for the first time.
  const updatePudoApiKey = useCallback(async (uid, apiKey) => {
    await userProfileService.savePudoApiKey(uid, apiKey);
    await notifyMainProcessApiKey(apiKey);
    setPudoApiKey(apiKey);
  }, []);

  // Re-reads the Firestore profile and re-validates the subscription.
  // Called by SubscriptionExpiredPage when the user clicks "I've subscribed — check again".
  const refreshProfile = useCallback(async () => {
    if (user) await loadUserProfile(user);
  }, [user, loadUserProfile]);

  // ── Context value ─────────────────────────────────────────────────────────────
  const value = {
    user,
    signUp,
    signIn,
    signOut,
    loading,
    // publicMode mirrors config.PUBLIC_MODE so components don't import config directly.
    publicMode: config.PUBLIC_MODE,
    // The fields below are only meaningful in PUBLIC_MODE=true.
    // In PUBLIC_MODE=false: subscriptionValid=false but the gate in App.jsx is
    // skipped (it checks publicMode first), so the app is always accessible.
    subscriptionValid,
    subscriptionTier,
    tierLimits: config.PUBLIC_MODE
      ? (TIER_LIMITS[subscriptionTier] ?? TIER_LIMITS[DEFAULT_TIER])
      : { maxCustomers: null, maxMonthlyBookings: null },
    pudoApiKey,
    userProfile,
    updatePudoApiKey,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
