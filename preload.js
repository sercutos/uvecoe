const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  // Funciones explícitas de la base de datos para autocompletado en React
  obtenerConfiguracion: () => ipcRenderer.invoke("db:obtenerConfiguracion"),
  guardarConfiguracion: (config) => ipcRenderer.invoke("db:guardarConfiguracion", config),
  obtenerUsuarioLocal: (email) => ipcRenderer.invoke("db:obtenerUsuarioLocal", email),
  guardarUsuarioLocal: (usuario) => ipcRenderer.invoke("db:guardarUsuarioLocal", usuario),
  getSetting: (key) => ipcRenderer.invoke("db:get-setting", key),
  setSetting: (key, value) => ipcRenderer.invoke("db:set-setting", key, value),
  obtenerEstudiantesLocales: () => ipcRenderer.invoke('db:obtener-estudiantes'),
  getStudents: () => ipcRenderer.invoke("db:getStudents"),
  obtenerPreguntasLocales: (params) => ipcRenderer.invoke('db:obtener-preguntas', params),
  obtenerRespuestasAlumno: (params) => ipcRenderer.invoke('db:obtener-respuestas-alumno', params),
  guardarResultadoLocal: (datos) => ipcRenderer.invoke('db:guardar-resultado', datos),
  sincronizarRespuestas: (token) => ipcRenderer.invoke('db:sincronizar-respuestas-al-servidor', token),
  contarPendientes: () => ipcRenderer.invoke('db:contar-pendientes'),
  guardarDatosIniciales: (payload) => ipcRenderer.invoke('db:guardarDatosIniciales', payload),
  obtenerShifts: (ecoeId) => ipcRenderer.invoke('db:obtener-shifts', ecoeId),
  obtenerRounds: (ecoeId) => ipcRenderer.invoke('db:obtener-rounds', ecoeId),
  obtenerPlanner: (shiftId, roundId) => ipcRenderer.invoke('db:obtener-planner', { shiftId, roundId }),
  obtenerEstudiantesPlanner: (plannerId) => ipcRenderer.invoke('db:obtener-estudiantes-planner', plannerId),
  asegurarReferencias: (payload) => ipcRenderer.invoke('db:asegurar-referencias', payload)
});