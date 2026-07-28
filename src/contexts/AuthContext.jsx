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
 *    • Privileged emails listed in config.INTERNAL_EMAILS authenticate against
 *      the internal Firebase project (when INTERNAL_FIREBASE is present) and
 *      get the private/internal experience: shared collections, baked PUDO key,
 *      no subscription gates.  publicMode is false for those sessions.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { authService, userProfileService } from "../firebase/services";
import { isInternalSession } from "../firebase/config";
import { crashlytics } from "../firebase/crashlytics";
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

  // Effective runtime mode: false for internal builds and for privileged emails
  // signed into the private Firebase project from a public build.
  const [publicMode, setPublicMode] = useState(config.PUBLIC_MODE === true);

  // subscriptionValid and userProfile are only meaningful in public sessions.
  // In internal mode they remain at their initial values and are never checked.
  const [subscriptionValid, setSubscriptionValid] = useState(false);
  const [subscriptionTier, setSubscriptionTier] = useState(DEFAULT_TIER);
  const [pudoApiKey, setPudoApiKey] = useState(null);

  // undefined  = profile not yet loaded (initial / loading state)
  // null       = document does not exist in Firestore (new or unsubscribed user)
  // object     = document loaded successfully
  const [userProfile, setUserProfile] = useState(undefined);

  // ── Profile loader (public sessions only) ───────────────────────────────────
  // Reads users/{uid} from the PUBLIC project's Firestore database, validates
  // the subscription, and wires up the PUDO API key.
  // For internal sessions this is a no-op — no Firestore profile reads.
  const loadUserProfile = useCallback(async (firebaseUser) => {
    if (!config.PUBLIC_MODE || isInternalSession || !firebaseUser) return;

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
    crashlytics.setUser(firebaseUser);
  }, []);

  // Internal / private session: skip subscription, use baked PUDO key.
  const activateInternalSession = useCallback(async (firebaseUser) => {
    setPublicMode(false);
    setSubscriptionValid(true);
    setSubscriptionTier(DEFAULT_TIER);
    setUserProfile(null);
    const key = config.PUDO_API_KEY || null;
    if (key) {
      await notifyMainProcessApiKey(key);
    }
    setPudoApiKey(key);
    if (firebaseUser) crashlytics.setUser(firebaseUser);
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
        if (isInternalSession || !config.PUBLIC_MODE) {
          await activateInternalSession(firebaseUser);
        } else {
          setPublicMode(true);
          await loadUserProfile(firebaseUser);
        }
      } else {
        // User signed out — clear all subscription state.
        setPublicMode(config.PUBLIC_MODE === true);
        setSubscriptionValid(false);
        setPudoApiKey(null);
        setUserProfile(undefined);
        crashlytics.clearUser();
        await notifyMainProcessApiKey(null);
      }
      setLoading(false);
    });

    return () => {
      clearTimeout(timeout);
      unsubscribe();
    };
  }, [loadUserProfile, activateInternalSession]);

  // ── Periodic subscription re-validation (public sessions only) ──────────────
  // Re-reads the Firestore profile once per day so that a subscription
  // which expires at midnight is caught even if the app is never closed.
  // When the subscription becomes invalid, App.jsx's gate renders
  // SubscriptionExpiredPage automatically.
  useEffect(() => {
    if (!publicMode || !user) return;

    const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
    const intervalId = setInterval(() => {
      loadUserProfile(user);
    }, INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [user, publicMode, loadUserProfile]);

  // ── Auth actions ─────────────────────────────────────────────────────────────

  const signUp = async (email, password) => {
    return authService.signUp(email, password);
  };

  const signIn = async (email, password) => {
    return authService.signIn(email, password);
  };

  const signOut = async () => {
    await authService.signOut();
    setPublicMode(config.PUBLIC_MODE === true);
    setSubscriptionValid(false);
    setSubscriptionTier(DEFAULT_TIER);
    setPudoApiKey(null);
    crashlytics.clearUser();
    await notifyMainProcessApiKey(null);
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
    // Effective runtime mode (false for privileged private sessions in public builds).
    publicMode,
    // The fields below are only meaningful in public sessions.
    // In internal mode: subscriptionValid may be true but the gate in App.jsx is
    // skipped (it checks publicMode first), so the app is always accessible.
    subscriptionValid,
    subscriptionTier,
    tierLimits: publicMode
      ? (TIER_LIMITS[subscriptionTier] ?? TIER_LIMITS[DEFAULT_TIER])
      : { maxCustomers: null, maxMonthlyBookings: null },
    pudoApiKey,
    userProfile,
    updatePudoApiKey,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
