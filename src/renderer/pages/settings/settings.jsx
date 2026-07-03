import Toolbar from "../../components/Toolbar";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";

import {
  Box,
  Grid,
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
import { getApiBaseUrl } from "../../utils/apiConfig";

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

  // 1. Cargar ECOEs disponibles al montar Settings
  useEffect(() => {
    async function fetchEcoes() {
      try {
        const token = sessionStorage.getItem("token_ecoe");
        const response = await fetch(`${getApiBaseUrl()}/backend/api/v1/ecoes`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          }
        });
        if (!response.ok) throw new Error("No autorizado");
        const data = await response.json();
        setEcoes(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Error cargando ECOEs:", error);
        setEcoes([]);
        setDownloadStatus("❌ No autorizado. Inicie sesión en el servidor primero.");
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
        const token = sessionStorage.getItem("token_ecoe");
        const response = await fetch(
          `${getApiBaseUrl()}/backend/api/v1/stations?ecoe_id=${selectedEcoe}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`
            }
          }
        );
        if (!response.ok) throw new Error("No autorizado");
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
        setStations([]);
        setDownloadStatus("❌ Error al cargar las estaciones.");
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
      if (!window.api || !window.api.invoke) {
        throw new Error("API de Electron no disponible");
      }

      const res = await window.api.invoke("db:sincronizar-respuestas-al-servidor");

      if (res.success) {
        setAlertInfo({
          show: true,
          severity: "success",
          msg: res.count > 0 ? res.message : "Todo al día: No había datos nuevos que subir."
        });
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
    }
  };

  // 📥 DESCARGA COMPLETA (ECOE + estación + preguntas + estudiantes + usuarios)
  const handleDescargarCompleto = async (e) => {
    e.preventDefault();
    if (!selectedEcoe || !selectedStation) return;

    setLoadingSync(true);
    setDownloadStatus("⏳ Descargando datos del servidor...");

    try {
      const token = sessionStorage.getItem("token_ecoe");
      const estacionActiva = stations.find(s => s.id === Number(selectedStation));

      // A) Obtener bloque
      const resBlocks = await fetch(
        `${getApiBaseUrl()}/backend/api/v1/blocks?station_id=${selectedStation}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          }
        }
      );
      const blocksData = await resBlocks.json();
      const block = blocksData?.items?.[0];

      const configLocal = {
        ecoe_id: Number(selectedEcoe),
        station_id: Number(selectedStation),
        station_name: estacionActiva?.name || `Estación ${selectedStation}`,
        block_id: block?.id || null
      };
      await window.api.guardarConfiguracion(configLocal);

      // B) Descargar preguntas
      setDownloadStatus("⏳ Descargando rúbrica de la estación...");
      const resPreguntas = await fetch(
        `${getApiBaseUrl()}/backend/api/v1/questions?station_id=${selectedStation}&per_page=500`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          }
        }
      );
      if (!resPreguntas.ok) throw new Error(`Error al descargar preguntas (Status: ${resPreguntas.status})`);
      const dataPreguntas = await resPreguntas.json();
      const questions = dataPreguntas.items || dataPreguntas;

      // C) Descargar estudiantes
      setDownloadStatus("⏳ Descargando lista de estudiantes asignados...");
      const resAlumnos = await fetch(
        `${getApiBaseUrl()}/backend/api/v1/students?per_page=500&id_ecoe=1`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          }
        }
      );
      if (!resAlumnos.ok) throw new Error(`Error al descargar estudiantes (Status: ${resAlumnos.status})`);
      const dataAlumnos = await resAlumnos.json();
      const students = dataAlumnos.items || dataAlumnos;

      // C.2) Descargar usuarios
      setDownloadStatus("⏳ Descargando lista de usuarios y evaluadores...");
      const resUsers = await fetch(
        `${getApiBaseUrl()}/backend/api/v1/users`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          }
        }
      );
      if (!resUsers.ok) throw new Error(`Error al descargar usuarios (Status: ${resUsers.status})`);
      const dataUsers = await resUsers.json();
      const users = dataUsers.items || dataUsers;

      // D) Volcar a SQLite
      setDownloadStatus("⏳ Almacenando información en la base de datos local SQLite...");
      await window.api.invoke("db:guardarDatosIniciales", {
        stationId: configLocal.station_id,
        id_block: block.id,
        questions,
        students,
        users
      });

      setDownloadStatus("✅ ¡Portátil configurado con éxito y listo para trabajar Offline!");
      setAlertInfo({
        show: true,
        severity: "success",
        msg: `✅ ECOE ${selectedEcoe} · Estación ${configLocal.station_name} descargada correctamente.`
      });
    } catch (error) {
      console.error("Error en la descarga:", error);
      setDownloadStatus("❌ Error crítico durante la descarga. Revisa la consola.");
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
                  URL base del servidor central (sin /backend/api/v1).
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
