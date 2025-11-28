const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const sqlite = require("./src/db/sqlite");
const isDev = process.env.NODE_ENV === "development";

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
      webSecurity: false, // permite cargar CSS/JS del dev server
      //webSecurity: isDev ? false : true, // permite cargar CSS/JS de Vite
    },
  });

  if (isDev) {
    win.loadURL("http://localhost:5173");
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, "dist/index.html")); // build Vite
  }
}

app.whenReady().then(createWindow);

// IPC
ipcMain.handle("get-users", () => sqlite.getUsers());
ipcMain.handle("add-user", (event, name) => {
  sqlite.addUser(name);
  return true;
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
