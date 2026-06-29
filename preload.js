const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  getUsers: () => ipcRenderer.invoke("get-users"),
  getStudents: () => ipcRenderer.invoke("get-students"),
  addUser: (name) => ipcRenderer.invoke("add-user", name),
  invoke: (channel, data) => ipcRenderer.invoke(channel, data),
});