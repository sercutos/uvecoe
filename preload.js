const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  getUsers: () => ipcRenderer.invoke("get-users"),
  addUser: (name) => ipcRenderer.invoke("add-user", name),
});