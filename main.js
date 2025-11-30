
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const sqlite = require("./src/db/sqlite");
const isDev = process.env.NODE_ENV === "development";

let mainWindow;
let splashWindow;
let loginWindow;


/* function createWindow() {
  // Splash
  splashWindow = new BrowserWindow({
    width: 400,
    height: 300,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
  });
  splashWindow.loadFile(path.join(__dirname, "assets/splash.html"));
  

  // Ventana principal (oculta al inicio)
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    show: false,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
      webSecurity: false,
    },
  });

  //Crea la ventana de login
  function createLoginWindow() {
    loginWindow = new BrowserWindow({
      width: 400,
      height: 500,
      resizable: false,
      webPreferences: {
        contextIsolation: true,
        preload: path.join(__dirname, "preload.js")
      }
    });

    if (isDev) {
      loginWindow.loadURL("http://localhost:5173/login"); // Ruta React para login
    } else {
      loginWindow.loadFile(path.join(__dirname, "dist/index.html")); // Ajusta si usas router
    }
  }



  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "dist/index.html"));
  }

  // Cuando esté lista, cerrar splash y mostrar principal
 
  mainWindow.once("ready-to-show", () => {
    setTimeout(() => {
      splashWindow.close();
      mainWindow.show();
    }, 5000); // 2 segundos para ver el splash
  });

}
 */
  //Crea la ventana de login
  function createLoginWindow() {
    loginWindow = new BrowserWindow({
      width: 400,
      height: 500,
      resizable: false,
      webPreferences: {
        contextIsolation: true,
        preload: path.join(__dirname, "preload.js")
      }
    });
  }

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
      width: 1000,
      height: 700,
      show: false,
      webPreferences: {
        contextIsolation: true,
        preload: path.join(__dirname, "preload.js"),
        webSecurity: false,
      },
    });

    if (isDev) {
      mainWindow.loadURL("http://localhost:5173");
      mainWindow.webContents.openDevTools();
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


// IPC para login
ipcMain.handle("login", async (event, { username, password }) => {
  const isValid = await sqlite.validateUser(username, password);
  if (isValid) {
    loginWindow.close();
    createMainWindow();
    //mainWindow.show();
  }
  return isValid;
});


app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
