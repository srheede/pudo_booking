const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const axios = require("axios");
const fs = require("fs");
const { config, getAuthHeaders } = require("./config");

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
