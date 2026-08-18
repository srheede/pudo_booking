/**
 * First-party product analytics for the Pudo Booking desktop app.
 *
 * Events are written to Firestore `/analyticsEvents/{id}` so the Gengar Games
 * admin monitoring page can query usage without a third-party analytics SDK.
 *
 * Never throws. Failures are logged only — analytics must not interrupt
 * booking, customer, or login flows.
 */

import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, isInternalSession } from "./config";
import config from "../../config.json";
import { version as APP_VERSION } from "../../package.json";

const SESSION_KEY = "pudo_analytics_session_id";
const APP = "desktop";

let currentUserId = null;
let currentUserEmail = null;
let initialized = false;
let lastScreen = null;
let sessionStartedAt = null;

const BOT_UA_RE =
  /googlebot|bingbot|yandex|baiduspider|duckduckbot|slurp|facebookexternalhit|headlesschrome|phantomjs|selenium|webdriver|puppeteer|playwright|\bbot\b|\bcrawler\b|\bspider\b/i;

function isDoNotTrack() {
  if (typeof navigator === "undefined") return false;
  return navigator.doNotTrack === "1" || window.doNotTrack === "1";
}

function isBotUserAgent() {
  if (typeof navigator === "undefined") return true;
  const ua = navigator.userAgent || "";
  if (!ua.trim()) return true;
  if (BOT_UA_RE.test(ua)) return true;
  if (navigator.webdriver === true) return true;
  return false;
}

function shouldSkip() {
  return isDoNotTrack() || isBotUserAgent();
}

function getOrCreateSessionId() {
  try {
    let sid = sessionStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid = crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY, sid);
    }
    return sid;
  } catch {
    return crypto.randomUUID();
  }
}

function detectPlatform() {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  if (/Windows NT/i.test(ua)) return { os: "Windows", platform: "Windows" };
  if (/Mac OS X/i.test(ua)) return { os: "macOS", platform: "macOS" };
  if (/Linux/i.test(ua)) return { os: "Linux", platform: "Linux" };
  return { os: "Other", platform: "Other" };
}

async function persist(payload) {
  try {
    await addDoc(collection(db, "analyticsEvents"), payload);
  } catch (err) {
    console.warn("[Analytics] Failed to persist event:", err);
  }
}

function baseFields() {
  const { os, platform } = detectPlatform();
  return {
    app: APP,
    source: isInternalSession || config.PUBLIC_MODE !== true ? "internal" : "public",
    sessionId: getOrCreateSessionId(),
    userId: currentUserId,
    userEmail: currentUserEmail,
    platform,
    os,
    appVersion: APP_VERSION,
    publicMode: config.PUBLIC_MODE === true,
    internalSession: isInternalSession === true,
    createdAt: serverTimestamp(),
    clientTime: new Date().toISOString(),
  };
}

export const analytics = {
  setUser(user) {
    currentUserId = user?.uid || null;
    currentUserEmail = user?.email || null;
  },

  clearUser() {
    currentUserId = null;
    currentUserEmail = null;
  },

  async screen(name) {
    if (!name || name === lastScreen || shouldSkip()) return;
    lastScreen = name;
    await persist({
      ...baseFields(),
      type: "page_view",
      name,
    });
  },

  async event(name, params = {}) {
    if (!name || shouldSkip()) return;
    await persist({
      ...baseFields(),
      type: "event",
      name,
      params,
    });
  },

  /**
   * Install session tracking once. Safe to call multiple times.
   */
  init() {
    if (initialized || typeof window === "undefined") return;
    initialized = true;
    if (shouldSkip()) return;

    sessionStartedAt = Date.now();
    persist({
      ...baseFields(),
      type: "session_start",
      name: "session_start",
    });

    const flushSession = () => {
      if (!sessionStartedAt) return;
      const durationSeconds = Math.round((Date.now() - sessionStartedAt) / 1000);
      sessionStartedAt = null;
      persist({
        ...baseFields(),
        type: "event",
        name: "session_end",
        params: { durationSeconds },
      });
    };

    window.addEventListener("beforeunload", flushSession);
  },
};

export default analytics;
