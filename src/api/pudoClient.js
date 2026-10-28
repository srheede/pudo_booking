/**
 * Unified PUDO API client.
 *
 * Electron uses IPC (main process net.fetch, no CORS).
 * Web and Capacitor call the authenticated Cloud Function proxy so the
 * per-user PUDO key never leaves the server.
 */

import { auth } from "../firebase/config";
import { getIpcRenderer } from "./platform";
import { combineWaybillPdfs, waybillFilename } from "./combineWaybills";
import { savePdf } from "./savePdf";

const PROXY_BASE =
  "https://africa-south1-pudo-booking-pub.cloudfunctions.net/pudoProxy";

async function getIdToken() {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Not signed in");
  }
  return user.getIdToken();
}

async function proxyRequest({ method = "GET", path, body, responseType = "json" }) {
  const token = await getIdToken();
  const response = await fetch(`${PROXY_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(responseType === "arraybuffer"
        ? { Accept: "application/pdf" }
        : { "Content-Type": "application/json", Accept: "application/json" }),
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    let detail = "";
    try {
      detail = (await response.text()).slice(0, 500);
    } catch {
      // ignore
    }
    let message = `PUDO API ${method} ${path} failed (${response.status})`;
    if (detail) {
      try {
        const parsed = JSON.parse(detail);
        message = parsed?.message || `${message}: ${detail}`;
      } catch {
        message = `${message}: ${detail}`;
      }
    }
    throw new Error(message);
  }

  if (responseType === "arraybuffer") {
    return response.arrayBuffer();
  }
  return response.json();
}

export async function getAllTerminals() {
  const ipc = getIpcRenderer();
  if (ipc) {
    return ipc.invoke("get-all-terminals");
  }
  return proxyRequest({ path: "/lockers-data" });
}

export async function getRates(payload) {
  const ipc = getIpcRenderer();
  if (ipc) {
    return ipc.invoke("get-rates", payload);
  }
  return proxyRequest({ method: "POST", path: "/rates", body: payload });
}

export async function createShipment(payload) {
  const ipc = getIpcRenderer();
  if (ipc) {
    return ipc.invoke("create-shipment", payload);
  }
  return proxyRequest({ method: "POST", path: "/shipments", body: payload });
}

export async function getShipment(shipmentId) {
  const ipc = getIpcRenderer();
  if (ipc) {
    return ipc.invoke("get-shipment", shipmentId);
  }
  return proxyRequest({ path: `/shipments/${encodeURIComponent(shipmentId)}` });
}

export async function cancelShipment(shipmentId) {
  const ipc = getIpcRenderer();
  if (ipc) {
    return ipc.invoke("cancel-shipment", shipmentId);
  }
  return proxyRequest({
    method: "PUT",
    path: `/shipments/${encodeURIComponent(shipmentId)}`,
    body: { status: "cancelled" },
  });
}

export async function downloadWaybillPdfs(shipments, { onProgress } = {}) {
  const ipc = getIpcRenderer();
  if (ipc) {
    return ipc.invoke("download-waybills-combined", shipments);
  }

  const pdfBuffers = [];
  for (let i = 0; i < shipments.length; i++) {
    onProgress?.(i + 1, shipments.length);
    const shipmentId = shipments[i].shipmentId;
    const buffer = await proxyRequest({
      path: `/generate/sticker/${encodeURIComponent(shipmentId)}`,
      responseType: "arraybuffer",
    });
    pdfBuffers.push(buffer);
  }

  const combined = await combineWaybillPdfs(pdfBuffers);
  const filename = waybillFilename(shipments);
  await savePdf(combined, filename);
  return { success: true, filename };
}

export function terminalsToMaps(terminals) {
  const lockersMap = {};
  const kiosksMap = {};
  if (!Array.isArray(terminals)) {
    return { lockersMap, kiosksMap };
  }
  terminals.forEach((terminal) => {
    if (terminal.type?.id === 2) {
      lockersMap[terminal.code] = terminal.name;
    } else if (terminal.type?.id === 1) {
      kiosksMap[terminal.code] = terminal.name;
    }
  });
  return { lockersMap, kiosksMap };
}

export function formatDeliveryLocation(customer, lockersMap = {}, kiosksMap = {}) {
  if (customer.deliveryType === "locker") {
    const lockerName = lockersMap[customer.lockerId];
    return lockerName
      ? `${customer.lockerId} - ${lockerName}`
      : customer.lockerId || "Not set";
  }
  if (customer.deliveryType === "kiosk") {
    const kioskName = kiosksMap[customer.kioskId];
    return kioskName
      ? `${customer.kioskId} - ${kioskName}`
      : customer.kioskId || "Not set";
  }
  const address = customer.address;
  if (address) {
    return `${address.street || ""}, ${address.suburb || ""}, ${
      address.city || ""
    }`.replace(/^,\s*|,\s*$/g, "");
  }
  return "Not set";
}

export function deliveryTypeChip(type) {
  if (type === "locker") return { label: "Locker", color: "primary" };
  if (type === "kiosk") return { label: "Kiosk", color: "warning" };
  return { label: "Address", color: "secondary" };
}
