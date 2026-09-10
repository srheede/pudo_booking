import { isElectron, isCapacitor } from "./platform";

const HOMEPAGE_URL = "https://pudo-booking.web.app";

export { HOMEPAGE_URL };

export async function openExternal(url) {
  if (isElectron()) {
    try {
      const { shell } = window.require("electron");
      await shell.openExternal(url);
      return;
    } catch {
      // fall through
    }
  }

  if (isCapacitor()) {
    try {
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url });
      return;
    } catch {
      // fall through
    }
  }

  window.open(url, "_blank", "noopener,noreferrer");
}
