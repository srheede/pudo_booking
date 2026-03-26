const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const axios = require("axios");
const fs = require("fs");
const config = require("../config.json");
const { PDFDocument } = require("pdf-lib");

const WAYBILL_BASE_URL = "https://api-pudo.co.za/generate/waybill";
const STICKER_BASE_URL = "https://api-pudo.co.za/generate/sticker";

// Helper function to get Authorization header
const getAuthHeaders = () => ({
  Authorization: `Bearer ${config.PUDO_API_KEY}`,
  "Content-Type": "application/json",
  Accept: "application/json",
});

let mainWindow;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
    },
    icon: path.join(__dirname, "../assets/icon.png"),
  });

  // Load the app - always use built files for consistency
  const buildPath = path.join(__dirname, "../build/index.html");
  const buildExists = fs.existsSync(buildPath);

  if (buildExists) {
    // Always use built files when they exist
    mainWindow.loadFile(buildPath);
  } else {
    // Error case - no build files found
    console.error("No build files found. Please run 'npm run build' first.");
    app.quit();
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// App event listeners
app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC handlers for Pudo API
ipcMain.handle("search-terminals", async (event, query) => {
  try {
    const response = await axios.get(`${config.API_BASE_URL}/lockers-data`, {
      headers: getAuthHeaders(),
    });

    // Filter lockers based on query if provided
    let lockers = response.data;
    if (query && query.trim().length > 0) {
      const searchTerm = query.toLowerCase();
      lockers = lockers.filter(
        (locker) =>
          locker.code.toLowerCase().includes(searchTerm) ||
          locker.name.toLowerCase().includes(searchTerm) ||
          (locker.address && locker.address.toLowerCase().includes(searchTerm))
      );
    }

    return lockers;
  } catch (error) {
    console.error("Error searching terminals:", error);
    throw error;
  }
});

ipcMain.handle("create-shipment", async (event, payload) => {
  try {
    const response = await axios.post(
      `${config.API_BASE_URL}/shipments`,
      payload,
      {
        headers: getAuthHeaders(),
      }
    );
    return response.data;
  } catch (error) {
    console.error("Error creating shipment:", error);
    throw error;
  }
});

ipcMain.handle("get-all-terminals", async (event) => {
  try {
    const response = await axios.get(`${config.API_BASE_URL}/lockers-data`, {
      headers: getAuthHeaders(),
    });

    return response.data;
  } catch (error) {
    console.error("Error getting terminals:", error);
    throw error;
  }
});

ipcMain.handle("get-all-shipments", async (event) => {
  try {
    const response = await axios.get(`${config.API_BASE_URL}/shipments`, {
      headers: getAuthHeaders(),
    });
    return response.data;
  } catch (error) {
    console.error("Error getting all shipments:", error);
    throw error;
  }
});

ipcMain.handle("get-shipment", async (event, shipmentId) => {
  try {
    const response = await axios.get(
      `${config.API_BASE_URL}/shipments/${shipmentId}`,
      { headers: getAuthHeaders() }
    );
    return response.data;
  } catch (error) {
    console.error("Error getting shipment:", error);
    throw error;
  }
});

ipcMain.handle("update-shipment", async (event, { shipmentId, payload }) => {
  try {
    const response = await axios.put(
      `${config.API_BASE_URL}/shipments/${shipmentId}`,
      payload,
      { headers: getAuthHeaders() }
    );
    return response.data;
  } catch (error) {
    console.error("Error updating shipment:", error);
    throw error;
  }
});

ipcMain.handle("cancel-shipment", async (event, shipmentId) => {
  try {
    const response = await axios.put(
      `${config.API_BASE_URL}/shipments/${shipmentId}`,
      { status: "cancelled" },
      { headers: getAuthHeaders() }
    );
    return response.data;
  } catch (error) {
    console.error("Error cancelling shipment:", error);
    throw error;
  }
});

// Combine multiple waybill PDFs onto A4 pages with 6 waybills per page (2 cols × 3 rows).
// Each waybill is scaled to 1/6 of the A4 area regardless of how many are selected.
async function combineWaybillPdfs(pdfBuffers) {
  const A4_W = 595.28;
  const A4_H = 841.89;
  const COLS = 2;
  const ROWS = 3;
  const WAYBILLS_PER_PAGE = COLS * ROWS;
  const SLOT_W = A4_W / COLS;
  const SLOT_H = A4_H / ROWS;

  const combinedDoc = await PDFDocument.create();

  for (let pageStart = 0; pageStart < pdfBuffers.length; pageStart += WAYBILLS_PER_PAGE) {
    const chunk = pdfBuffers.slice(pageStart, pageStart + WAYBILLS_PER_PAGE);
    const page = combinedDoc.addPage([A4_W, A4_H]);

    for (let i = 0; i < chunk.length; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const slotX = col * SLOT_W;
      const slotY = A4_H - (row + 1) * SLOT_H;

      const waybillDoc = await PDFDocument.load(chunk[i]);
      const [embeddedPage] = await combinedDoc.embedPdf(waybillDoc);
      const { width: origW, height: origH } = embeddedPage;
      const scale = Math.min(SLOT_W / origW, SLOT_H / origH);
      const scaledW = origW * scale;
      const scaledH = origH * scale;

      page.drawPage(embeddedPage, {
        x: slotX + (SLOT_W - scaledW) / 2,
        y: slotY + (SLOT_H - scaledH) / 2,
        width: scaledW,
        height: scaledH,
      });
    }
  }

  return combinedDoc.save();
}

// Download and combine PUDO waybill PDFs — fits 6 per A4 page (2 cols × 3 rows).
// Accepts an array of { shipmentId, trackingRef } objects.
ipcMain.handle("download-waybills-combined", async (event, shipments) => {
  try {
    const pdfBuffers = await Promise.all(
      shipments.map(({ shipmentId }) =>
        axios
          .get(`${STICKER_BASE_URL}/${shipmentId}`, {
            params: { api_key: config.PUDO_API_KEY },
            responseType: "arraybuffer",
          })
          .then((r) => r.data)
      )
    );

    const combinedPdf = await combineWaybillPdfs(pdfBuffers);

    const downloadsPath = app.getPath("downloads");
    const firstName = shipments[0]?.trackingRef || String(shipments[0]?.shipmentId);
    const filename =
      shipments.length === 1
        ? `${firstName}.pdf`
        : `waybills_${firstName}_+${shipments.length - 1}.pdf`;
    const filepath = path.join(downloadsPath, filename);
    fs.writeFileSync(filepath, Buffer.from(combinedPdf));
    shell.showItemInFolder(filepath);

    return { success: true, filepath, filename };
  } catch (error) {
    console.error("Error downloading waybills:", error);
    throw error;
  }
});
