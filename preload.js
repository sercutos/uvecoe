const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  // 🚀 El canal genérico (comodín para ahorrar código en preload)
  invoke: (channel, data) => ipcRenderer.invoke(channel, data),

  // Funciones explícitas de la base de datos para autocompletado en React
  obtenerConfiguracion: () => ipcRenderer.invoke("db:obtenerConfiguracion"),
  guardarConfiguracion: (config) => ipcRenderer.invoke("db:guardarConfiguracion", config),
  obtenerUsuarioLocal: (email) => ipcRenderer.invoke("db:obtenerUsuarioLocal", email),
  guardarUsuarioLocal: (usuario) => ipcRenderer.invoke("db:guardarUsuarioLocal", usuario),
  obtenerAlumnosLocales: () => ipcRenderer.invoke('db:obtener-alumnos'),
  obtenerPreguntasLocales: () => ipcRenderer.invoke('db:obtener-preguntas'),
  guardarResultadoLocal: (datos) => ipcRenderer.invoke('db:guardar-resultado', datos),
  descargarPreguntasServidor: (stationId) => ipcRenderer.invoke('db:descargar-preguntas-servidor', stationId)
});