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

// Limits per tier. null means unlimited.
export const TIER_LIMITS = {
  starter:      { maxCustomers: 50,  maxMonthlyBookings: 100 },
  professional: { maxCustomers: 200, maxMonthlyBookings: 500 },
  business:     { maxCustomers: null, maxMonthlyBookings: null },
};

// Existing subscribers without a tier field default to professional.
const DEFAULT_TIER = "professional";

const isSubscriptionValid = (profileData) => {
  if (!profileData) return false;
  if (profileData.subscriptionStatus !== "active") return false;
  if (!profileData.subscriptionEndDate) return false;
  const endDate = profileData.subscriptionEndDate.seconds
    ? new Date(profileData.subscriptionEndDate.seconds * 1000)
    : new Date(profileData.subscriptionEndDate);
  return endDate > new Date();
};

const notifyMainProcessApiKey = (apiKey) => {
  try {
    const { ipcRenderer } = window.require("electron");
    ipcRenderer.invoke("set-pudo-api-key", apiKey);
  } catch {
    // Not in Electron context (dev/browser preview) — silently ignore.
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subscriptionValid, setSubscriptionValid] = useState(false);
  const [subscriptionTier, setSubscriptionTier] = useState(DEFAULT_TIER);
  const [pudoApiKey, setPudoApiKey] = useState(null);
  const [userProfile, setUserProfile] = useState(undefined);

  const loadUserProfile = useCallback(async (firebaseUser) => {
    if (!config.PUBLIC_MODE || !firebaseUser) return;
    const profile = await userProfileService.get(firebaseUser.uid);
    setUserProfile(profile);
    const valid = isSubscriptionValid(profile);
    setSubscriptionValid(valid);
    const tier = TIER_LIMITS[profile?.subscriptionTier] ? profile.subscriptionTier : DEFAULT_TIER;
    setSubscriptionTier(tier);
    const key = profile?.pudoApiKey ?? null;
    setPudoApiKey(key);
    if (key) {
      notifyMainProcessApiKey(key);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = authService.onAuthStateChanged(async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await loadUserProfile(firebaseUser);
      } else {
        setSubscriptionValid(false);
        setPudoApiKey(null);
        setUserProfile(undefined);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [loadUserProfile]);

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

  /**
   * Called by ApiKeySetupPage after the user saves their PUDO API key.
   * Updates local state and notifies the Electron main process.
   */
  const updatePudoApiKey = useCallback(async (uid, apiKey) => {
    await userProfileService.savePudoApiKey(uid, apiKey);
    setPudoApiKey(apiKey);
    notifyMainProcessApiKey(apiKey);
  }, []);

  /**
   * Refresh profile data (e.g. after returning from subscription renewal).
   */
  const refreshProfile = useCallback(async () => {
    if (user) await loadUserProfile(user);
  }, [user, loadUserProfile]);

  const value = {
    user,
    signUp,
    signIn,
    signOut,
    loading,
    subscriptionValid,
    subscriptionTier,
    tierLimits: TIER_LIMITS[subscriptionTier] ?? TIER_LIMITS[DEFAULT_TIER],
    pudoApiKey,
    userProfile,
    updatePudoApiKey,
    refreshProfile,
    publicMode: config.PUBLIC_MODE,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
