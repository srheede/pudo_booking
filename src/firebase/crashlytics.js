/**
 * Lightweight Crashlytics-style error reporting for this Electron app.
 *
 * Firebase Crashlytics does not officially support Electron/desktop, so errors
 * are written to Firestore where they can be inspected in the Firebase Console:
 *   • Public sessions  → /users/{uid}/crashReports/{id}
 *   • Internal sessions → /crashReports/{id}
 *
 * Also mirrors critical errors to the Electron main process via IPC so they
 * appear in main-process logs on the user's machine.
 */

import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, isInternalSession } from "./config";
import config from "../../config.json";

const APP_VERSION = "1.0.0";

let currentUserId = null;
let currentUserEmail = null;
let initialized = false;

const getIpc = () => {
  try {
    if (typeof window !== "undefined" && window.require) {
      return window.require("electron").ipcRenderer;
    }
  } catch {
    // browser / non-electron
  }
  return null;
};

const serializeError = (error) => {
  if (!error) return { message: "Unknown error" };
  if (typeof error === "string") return { message: error };
  return {
    message: error.message || String(error),
    name: error.name || "Error",
    stack: error.stack ? String(error.stack).slice(0, 8000) : undefined,
    code: error.code,
  };
};

const buildReport = (error, context = {}) => ({
  ...serializeError(error),
  context: {
    ...context,
    platform: typeof process !== "undefined" ? process.platform : "unknown",
    userAgent:
      typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    publicMode: config.PUBLIC_MODE === true,
    internalSession: isInternalSession === true,
    appVersion: APP_VERSION,
  },
  userId: currentUserId || null,
  userEmail: currentUserEmail || null,
  createdAt: serverTimestamp(),
  clientTime: new Date().toISOString(),
});

const persistReport = async (report) => {
  try {
    const useUserPath =
      config.PUBLIC_MODE && currentUserId && !isInternalSession;
    const col = useUserPath
      ? collection(db, "users", currentUserId, "crashReports")
      : collection(db, "crashReports");
    await addDoc(col, report);
  } catch (err) {
    // Never let reporting itself break the app.
    console.error("[Crashlytics] Failed to persist report:", err);
  }

  try {
    const ipc = getIpc();
    if (ipc) {
      await ipc.invoke("crashlytics-log", {
        message: report.message,
        name: report.name,
        context: report.context,
        userId: report.userId,
        clientTime: report.clientTime,
      });
    }
  } catch {
    // ignore IPC failures
  }
};

export const crashlytics = {
  /** Call after login so reports are attributed to the user. */
  setUser(user) {
    currentUserId = user?.uid || null;
    currentUserEmail = user?.email || null;
  },

  clearUser() {
    currentUserId = null;
    currentUserEmail = null;
  },

  /** Record a handled error (API failure, validation, etc.). */
  async recordError(error, context = {}) {
    console.error("[Crashlytics]", error, context);
    await persistReport(buildReport(error, context));
  },

  /** Record a non-fatal breadcrumb-style log. */
  async log(message, context = {}) {
    await persistReport(
      buildReport(new Error(message), { ...context, level: "log" })
    );
  },

  /**
   * Install global handlers once. Safe to call multiple times.
   * Captures window errors, unhandled rejections, and (optionally) React.
   */
  init() {
    if (initialized || typeof window === "undefined") return;
    initialized = true;

    window.addEventListener("error", (event) => {
      crashlytics.recordError(event.error || event.message, {
        source: "window.onerror",
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    });

    window.addEventListener("unhandledrejection", (event) => {
      crashlytics.recordError(event.reason, {
        source: "unhandledrejection",
      });
    });
  },
};

export default crashlytics;
