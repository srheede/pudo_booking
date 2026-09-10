/**
 * Runtime detection for Electron, Capacitor (iOS/Android), and browser.
 */

export function isElectron() {
  try {
    return !!(typeof window !== "undefined" && window.require && window.require("electron"));
  } catch {
    return false;
  }
}

export function isCapacitor() {
  try {
    return typeof window !== "undefined" && !!window.Capacitor?.isNativePlatform?.();
  } catch {
    return false;
  }
}

export function getRuntime() {
  if (isElectron()) return "electron";
  if (isCapacitor()) return "capacitor";
  return "web";
}

export function getIpcRenderer() {
  try {
    if (isElectron()) {
      return window.require("electron").ipcRenderer;
    }
  } catch {
    // not Electron
  }
  return null;
}
