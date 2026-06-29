
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const sqlite = require("./src/db/sqlite");
const isDev = process.env.NODE_ENV === "development";

let mainWindow;
let splashWindow;
let loginWindow;


  function createWindow() {
    splashWindow = new BrowserWindow({
      width: 400,
      height: 300,
      transparent: true,
      frame: false,
      alwaysOnTop: true,
    });
    splashWindow.loadFile(path.join(__dirname, "assets/splash.html"));

    splashWindow.once("ready-to-show", () => {
      setTimeout(() => {
        splashWindow.close();
        //createLoginWindow(); // Abrimos login después del splash
        createMainWindow(); // Abrimos la principal directamente
      }, 1000);
    });
  }

  
  function createMainWindow() {
    mainWindow = new BrowserWindow({
      width: 1400,
      height: 700,
      show: false,
      icon: path.join(__dirname, '/assets/images/icono.png'),
      webPreferences: {
        contextIsolation: true,
        preload: path.join(__dirname, "preload.js"),
        webSecurity: false,
      },
    });

    // Esto quita el menú nativo
    mainWindow.setMenu(null);


    if (isDev) {
      mainWindow.loadURL("http://localhost:5173");
      mainWindow.webContents.openDevTools(); // Abre el herramientas de desarrollador
    } else {
      mainWindow.loadFile(path.join(__dirname, "dist/index.html"));
    }

    mainWindow.once("ready-to-show", () => {
      mainWindow.show();
    });
  }


app.whenReady().then(createWindow);

// IPC
ipcMain.handle("get-users", () => sqlite.getUsers());
ipcMain.handle("add-user", (event, name) => {
  //sqlite.addUser(name);
  return true;
});
ipcMain.handle("get-students", () => sqlite.getStudents());


// IPC para login
ipcMain.handle("login", (event, { email, password }) => {
  const user = sqlite.validateUser(email, password);

  if (user) {
      if (loginWindow) loginWindow.close();     

      return { success: true, user };
    }

    return { success: false };
});




app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
