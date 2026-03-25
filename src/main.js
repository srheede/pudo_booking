const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const axios = require("axios");
const fs = require("fs");
const config = require("../config.json");

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

// Download the official PUDO waybill PDF for a shipment.
// The PUDO API returns a signed S3 URL; we fetch the PDF binary and save it
// to the user's Downloads folder, then reveal it in Finder/Explorer.
ipcMain.handle("download-waybill", async (event, { shipmentId, trackingRef }) => {
  try {
    // Step 1: get signed S3 URL from PUDO
    const urlResponse = await axios.get(`${WAYBILL_BASE_URL}/${shipmentId}`, {
      params: { api_key: config.PUDO_API_KEY },
    });

    // The response may be a plain URL string or an object with a url/link field
    let signedUrl;
    if (typeof urlResponse.data === "string") {
      signedUrl = urlResponse.data.trim();
    } else if (urlResponse.data?.url) {
      signedUrl = urlResponse.data.url;
    } else if (urlResponse.data?.link) {
      signedUrl = urlResponse.data.link;
    } else {
      throw new Error("Unexpected response format from waybill endpoint: " + JSON.stringify(urlResponse.data));
    }

    // Step 2: download the PDF binary
    const pdfResponse = await axios.get(signedUrl, { responseType: "arraybuffer" });

    // Step 3: save to Downloads folder
    const downloadsPath = app.getPath("downloads");
    const filename = `${trackingRef || shipmentId}.pdf`;
    const filepath = path.join(downloadsPath, filename);
    fs.writeFileSync(filepath, Buffer.from(pdfResponse.data));

    // Step 4: reveal in file manager
    shell.showItemInFolder(filepath);

    return { success: true, filepath, filename };
  } catch (error) {
    console.error("Error downloading waybill:", error);
    throw error;
  }
});
