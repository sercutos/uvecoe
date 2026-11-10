import Toolbar from "../../components/Toolbar";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";

import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from "@mui/material";
import Grid from "@mui/material/GridLegacy";
import { getApiBaseUrl } from "../../utils/apiConfig";
import { timeoutSignal } from "../../utils/api";
import { fetchStationData } from "../../utils/stationData";
import {
  clearServerAuthRequired,
  getServerToken,
  getSessionOrganizationId,
  isSuperadminSession,
  markServerAuthRequired
} from "../../utils/auth";

export default function Settings() {
  const navigate = useNavigate();

  // 📝 Estados para feedback visual
  const [loadingSync, setLoadingSync] = useState(false);
  const [loadingExport, setLoadingExport] = useState(false);
  const [alertInfo, setAlertInfo] = useState({ show: false, severity: "info", msg: "" });
  const [pendingCount, setPendingCount] = useState(0);
  const [serverUrl, setServerUrl] = useState("");
  const [savingUrl, setSavingUrl] = useState(false);
  const [currentUrl, setCurrentUrl] = useState("");

  // 📥 Estados para descarga completa (ECOE + estación)
  const [ecoes, setEcoes] = useState([]);
  const [stations, setStations] = useState([]);
  const [selectedEcoe, setSelectedEcoe] = useState("");
  const [selectedStation, setSelectedStation] = useState("");
  const [downloadStatus, setDownloadStatus] = useState("");

  // 🔄 Cargar la URL del servidor desde la DB al montar
  useEffect(() => {
    async function loadServerUrl() {
      try {
        const url = await window.api.getSetting("api_base_url");
        const base = url || "http://localhost:8000";
        setServerUrl(base);
        setCurrentUrl(base);
      } catch (e) {
        console.warn("[Settings] No se pudo cargar URL del servidor");
      }
    }
    loadServerUrl();
  }, []);

  // Contador de respuestas pendientes de sincronizar
  useEffect(() => {
    let active = true;

    const refreshPending = async () => {
      try {
        if (!window.api?.contarPendientes) return;
        const count = await window.api.contarPendientes();
        if (active) setPendingCount(Number(count) || 0);
      } catch (error) {
        console.warn("[Settings] No se pudo contar pendientes:", error);
      }
    };

    refreshPending();
    const interval = setInterval(refreshPending, 10000);
    window.addEventListener("uvecoe:pending-changed", refreshPending);

    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener("uvecoe:pending-changed", refreshPending);
    };
  }, []);

  // 1. Cargar ECOEs disponibles al montar Settings
  useEffect(() => {
    async function fetchEcoes() {
      try {
        const token = getServerToken();
        if (!token) {
          markServerAuthRequired();
          window.dispatchEvent(new Event("uvecoe:pending-changed"));
          setEcoes([]);
          setDownloadStatus(
            "❌ La sesión del servidor ha caducado. Reconecta en la barra superior."
          );
          return;
        }

        const response = await fetch(`${getApiBaseUrl()}/backend/api/v1/ecoes`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          signal: timeoutSignal()
        });
        if (!response.ok) {
          const error = new Error("No autorizado");
          error.status = response.status;
          throw error;
        }
        const data = await response.json();
        const lista = Array.isArray(data) ? data : [];
        const isSuperadmin = isSuperadminSession();
        const orgId = getSessionOrganizationId();

        if (!isSuperadmin && orgId === null) {
          setEcoes([]);
          setDownloadStatus(
            "❌ No se pudo determinar la organización de este usuario."
          );
          return;
        }

        setEcoes(
          isSuperadmin
            ? lista
            : lista.filter(
                (ecoe) => Number(ecoe.id_organization) === orgId
              )
        );
      } catch (error) {
        console.error("Error cargando ECOEs:", error);
        if (error.status === 401) {
          markServerAuthRequired();
          window.dispatchEvent(new Event("uvecoe:pending-changed"));
        }
        setEcoes([]);
        setDownloadStatus(
          error.name === "TimeoutError" || error.name === "AbortError"
            ? "❌ El servidor no respondió a tiempo."
            : "❌ No autorizado. Inicie sesión en el servidor primero."
        );
      }
    }
    fetchEcoes();
  }, []);

  // 2. Cargar estaciones cuando cambia el ECOE
  useEffect(() => {
    if (!selectedEcoe) {
      setStations([]);
      return;
    }
    async function fetchStations() {
      try {
        const token = getServerToken();
        if (!token) {
          markServerAuthRequired();
          window.dispatchEvent(new Event("uvecoe:pending-changed"));
          setStations([]);
          setDownloadStatus(
            "❌ La sesión del servidor ha caducado. Reconecta en la barra superior."
          );
          return;
        }

        const response = await fetch(
          `${getApiBaseUrl()}/backend/api/v1/stations?ecoe_id=${selectedEcoe}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`
            },
            signal: timeoutSignal()
          }
        );
        if (!response.ok) {
          const error = new Error("No autorizado");
          error.status = response.status;
          throw error;
        }
        const data = await response.json();
        if (data && Array.isArray(data.items)) {
          setStations(data.items);
        } else if (Array.isArray(data)) {
          setStations(data);
        } else {
          setStations([]);
        }
      } catch (error) {
        console.error("Error cargando estaciones:", error);
        if (error.status === 401) {
          markServerAuthRequired();
          window.dispatchEvent(new Event("uvecoe:pending-changed"));
        }
        setStations([]);
        setDownloadStatus(
          error.name === "TimeoutError" || error.name === "AbortError"
            ? "❌ El servidor no respondió a tiempo."
            : "❌ Error al cargar las estaciones."
        );
      }
    }
    fetchStations();
  }, [selectedEcoe]);

  // 💾 GUARDAR URL DEL SERVIDOR
  const handleSaveServerUrl = async () => {
    if (!serverUrl.trim()) return;
    setSavingUrl(true);
    try {
      await window.api.setSetting("api_base_url", serverUrl.trim());
      sessionStorage.setItem("api_base_url", serverUrl.trim());
      setCurrentUrl(serverUrl.trim());
      setAlertInfo({ show: true, severity: "success", msg: "✅ URL del servidor guardada correctamente." });
    } catch (e) {
      setAlertInfo({ show: true, severity: "error", msg: `❌ Error al guardar: ${e.message}` });
    } finally {
      setSavingUrl(false);
    }
  };

  // 📤 SUBIR RESPUESTAS AL SERVIDOR
  const handleSubirResultados = async () => {
    setLoadingExport(true);
    setAlertInfo({ show: false, severity: "info", msg: "" });

    try {
      if (!window.api || !window.api.sincronizarRespuestas) {
        throw new Error("API de Electron no disponible");
      }

      const token = getServerToken();
      if (!token) {
        markServerAuthRequired();
        throw new Error(
          "La sesión del servidor ha caducado. Usa 'Reconectar' en la barra superior."
        );
      }

      const res = await window.api.sincronizarRespuestas(token);

      if (res.success) {
        clearServerAuthRequired();
        setAlertInfo({
          show: true,
          severity: "success",
          msg: res.count > 0 ? res.message : "Todo al día: No había datos nuevos que subir."
        });
      } else if (res.code === "unauthorized" || res.status === 401) {
        markServerAuthRequired();
        throw new Error(
          "La sesión del servidor ha caducado. Usa 'Reconectar' en la barra superior."
        );
      } else {
        throw new Error(res.error || "Fallo desconocido al subir");
      }
    } catch (error) {
      setAlertInfo({
        show: true,
        severity: "error",
        msg: `Error en la exportación: ${error.message}`
      });
    } finally {
      setLoadingExport(false);

      try {
        const count = await window.api.contarPendientes();
        setPendingCount(Number(count) || 0);
      } catch {
        // La consulta periódica lo actualizará.
      }

      window.dispatchEvent(new Event("uvecoe:pending-changed"));
    }
  };

  // 📥 DESCARGA COMPLETA (ECOE + estación + planificación + alumnos + usuarios)
  const handleDescargarCompleto = async (e) => {
    e.preventDefault();
    if (!selectedEcoe || !selectedStation) return;

    const ecoeSeleccionada = ecoes.find(
      (ecoe) => Number(ecoe.id) === Number(selectedEcoe)
    );
    const orgId = getSessionOrganizationId();

    if (
      !ecoeSeleccionada ||
      (!isSuperadminSession() &&
        (orgId === null ||
          Number(ecoeSeleccionada.id_organization) !== orgId))
    ) {
      setDownloadStatus("❌ No tiene permiso para descargar esta ECOE.");
      setAlertInfo({
        show: true,
        severity: "error",
        msg: "No tiene permiso para descargar esta ECOE."
      });
      return;
    }

    if (!getServerToken()) {
      markServerAuthRequired();
      window.dispatchEvent(new Event("uvecoe:pending-changed"));
      setDownloadStatus(
        "❌ La sesión del servidor ha caducado. Reconecta en la barra superior."
      );
      setAlertInfo({
        show: true,
        severity: "error",
        msg: "Reconecta con el servidor antes de descargar datos."
      });
      return;
    }

    setLoadingSync(true);
    setDownloadStatus("⏳ Descargando datos del servidor...");

    try {
      const estacionActiva = stations.find(
        (s) => Number(s.id) === Number(selectedStation)
      );

      const data = await fetchStationData({
        ecoeId: Number(selectedEcoe),
        stationId: Number(selectedStation)
      });

      const configLocal = {
        ecoe_id: Number(selectedEcoe),
        station_id: Number(selectedStation),
        station_name:
          estacionActiva?.name ||
          data.station?.name ||
          `Estación ${selectedStation}`,
        block_id: data.block.id,
        station_order:
          data.station?.order ?? estacionActiva?.order ?? null
      };

      setDownloadStatus(
        "⏳ Almacenando información en la base de datos local SQLite..."
      );

      // Primero los datos y al final la configuración.
      await window.api.guardarDatosIniciales({
        stationId: configLocal.station_id,
        id_block: configLocal.block_id,
        questions: data.questions,
        students: data.students,
        users: data.users,
        shifts: data.shifts,
        rounds: data.rounds,
        planners: data.planners,
        answers: data.answers
      });

      await window.api.guardarConfiguracion(configLocal);

      setDownloadStatus(
        "✅ ¡Portátil configurado con éxito y listo para trabajar Offline!"
      );
      setAlertInfo({
        show: true,
        severity: "success",
        msg: `✅ ECOE ${selectedEcoe} · Estación ${configLocal.station_name} descargada correctamente.`
      });
    } catch (error) {
      console.error("Error en la descarga:", error);
      if (
        error.status === 401 ||
        (typeof error.message === "string" &&
          error.message.startsWith("No autorizado"))
      ) {
        markServerAuthRequired();
        window.dispatchEvent(new Event("uvecoe:pending-changed"));
      }
      setDownloadStatus(
        `❌ Error crítico durante la descarga: ${error.message}`
      );
      setAlertInfo({
        show: true,
        severity: "error",
        msg: `Error: ${error.message}`
      });
    } finally {
      setLoadingSync(false);
    }
  };

  return (
    <>
      <Toolbar />

      <Box sx={{ p: 4, marginTop: "60px" }}>
        <Typography variant="h4" gutterBottom>
          ⚙️ Settings & Sincronización
        </Typography>

        <Alert severity="info" sx={{ mb: 3 }}>
          Sistema offline activo - SQLite persistiendo localmente en tiempo real
        </Alert>

        {/* Alerta de Feedback dinámico */}
        {alertInfo.show && (
          <Alert severity={alertInfo.severity} sx={{ mb: 3 }} onClose={() => setAlertInfo({ ...alertInfo, show: false })}>
            {alertInfo.msg}
          </Alert>
        )}

        <Grid container spacing={3}>
          {/* 📥 Descarga Completa (ECOE + Estación) */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6">⬇️ Descargar Datos Iniciales</Typography>
                <Typography variant="body2" sx={{ mt: 1, color: "text.secondary" }}>
                  Selecciona el ECOE y la estación para descargar rúbricas,
                  estudiantes y usuarios del servidor central.
                </Typography>
                {!isSuperadminSession() && (
                  <Typography
                    variant="caption"
                    sx={{ mt: 1, display: "block", color: "text.secondary" }}
                  >
                    Solo se muestran las ECOEs de tu organización.
                  </Typography>
                )}

                <Box component="form" onSubmit={handleDescargarCompleto} sx={{ mt: 2, display: "flex", flexDirection: "column", gap: 2 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>1. Seleccionar ECOE</InputLabel>
                    <Select
                      value={selectedEcoe}
                      label="1. Seleccionar ECOE"
                      onChange={(e) => setSelectedEcoe(e.target.value)}
                      disabled={loadingSync}
                    >
                      <MenuItem value="">-- Seleccionar Examen --</MenuItem>
                      {ecoes.map(ecoe => (
                        <MenuItem key={ecoe.id} value={ecoe.id}>
                          {ecoe.nombre || ecoe.name || `ECOE ID: ${ecoe.id}`}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl fullWidth size="small">
                    <InputLabel>2. Seleccionar Estación</InputLabel>
                    <Select
                      value={selectedStation}
                      label="2. Seleccionar Estación"
                      onChange={(e) => setSelectedStation(e.target.value)}
                      disabled={loadingSync || !selectedEcoe}
                    >
                      <MenuItem value="">-- Seleccionar Estación --</MenuItem>
                      {stations.map(station => (
                        <MenuItem key={station.id} value={station.id}>
                          {station.name} (ID: {station.id})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <Button
                    type="submit"
                    variant="contained"
                    disabled={loadingSync || !selectedStation}
                    startIcon={loadingSync && <CircularProgress size={20} color="inherit" />}
                  >
                    {loadingSync ? "Descargando..." : "📥 Descargar Datos"}
                  </Button>
                </Box>

                {downloadStatus && (
                  <Alert severity={downloadStatus.includes("❌") ? "error" : downloadStatus.includes("✅") ? "success" : "info"} sx={{ mt: 2 }}>
                    {downloadStatus}
                  </Alert>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* 📁 Exportar / Subir */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6">⬆️ Exportar Evaluaciones (Laptop → Servidor)</Typography>
                <Typography variant="body2" sx={{ mt: 1, color: "text.secondary" }}>
                  Envía el lote masivo (Bulk) de notas almacenadas sin conexión en este equipo hacia la plataforma en la nube.
                </Typography>

                <Typography variant="body2" sx={{ mt: 1 }}>
                  Respuestas pendientes: <strong>{pendingCount}</strong>
                </Typography>

                <Button 
                  variant="contained" 
                  color="success" 
                  sx={{ mt: 2 }}
                  onClick={handleSubirResultados}
                  disabled={loadingSync || loadingExport}
                  startIcon={loadingExport && <CircularProgress size={20} color="inherit" />}
                >
                  {loadingExport ? "Subiendo lote..." : "Sincronizar Exámenes"}
                </Button>
              </CardContent>
            </Card>
          </Grid>

          {/* 🌐 Configuración del Servidor */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6">🌐 Servidor FastAPI</Typography>
                <Typography variant="body2" sx={{ mt: 1, color: "text.secondary" }}>
                  URL base de Caddy/nginx (sin /backend/api/v1). El cronómetro usa
                  el mismo origen para /socket.io; no pongas el puerto 8000 directo.
                </Typography>
                <Box sx={{ display: "flex", gap: 1, mt: 2 }}>
                  <TextField
                    size="small"
                    fullWidth
                    value={serverUrl}
                    onChange={(e) => setServerUrl(e.target.value)}
                    placeholder="http://localhost:8000"
                    disabled={savingUrl}
                  />
                  <Button
                    variant="contained"
                    onClick={handleSaveServerUrl}
                    disabled={savingUrl || serverUrl === currentUrl}
                    sx={{ flexShrink: 0 }}
                  >
                    {savingUrl ? "..." : "Guardar"}
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* 🧹 Reset DB */}
          <Grid item xs={12} md={6}>
            <Card sx={{ border: "1px solid #ffcccc" }}>
              <CardContent>
                <Typography variant="h6">🧹 Limpieza de Seguridad</Typography>
                <Typography variant="body2" sx={{ mt: 1, color: "text.secondary" }}>
                  Borra todos los datos y restablece el portátil a los valores de fábrica (Solo usar al acabar todo el evento ECOE).
                </Typography>

                <Button 
                  variant="outlined" 
                  color="error" 
                  sx={{ mt: 2 }}
                  onClick={() => alert("Para resetear la DB inicia el entorno de pruebas con 'npm run dev:clean'")}
                >
                  Reset DB Local
                </Button>
              </CardContent>
            </Card>
          </Grid>

          {/* 📊 Estado */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6">📊 Estado de conectividad</Typography>
                <Box sx={{ mt: 2 }}>
                  <Typography>Motor local: 🟢 SQLite Activo</Typography>
                  <Typography>Servidor Central: 🟢 {currentUrl || "No configurado"}</Typography>
                  <Typography variant="subtitle2" sx={{ mt: 1, color: "text.secondary" }}>
                    Nota: Los interruptores de evaluación se guardan inmediatamente en caliente al hacer click.
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

        </Grid>
      </Box>
    </>
  );
}
