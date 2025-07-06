const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const axios = require("axios");
require("dotenv").config();

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

  // Load the app
  const isDev = process.env.NODE_ENV === "development";

  if (isDev) {
    mainWindow.loadURL("http://localhost:3000");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../build/index.html"));
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
    const response = await axios.get(
      `https://api-pudo.co.za/api/v1/lockers-data`,
      {
        headers: {
          Authorization: process.env.PUDO_API_KEY,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      }
    );

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
      "https://api-pudo.co.za/api/v1/shipments",
      payload,
      {
        headers: {
          Authorization: process.env.PUDO_API_KEY,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
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
    const response = await axios.get(
      "https://api-pudo.co.za/api/v1/lockers-data",
      {
        headers: {
          Authorization: process.env.PUDO_API_KEY,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error("Error getting terminals:", error);
    throw error;
  }
});
