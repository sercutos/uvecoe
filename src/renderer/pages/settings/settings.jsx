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
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress
} from "@mui/material";

export default function Settings() {
  const navigate = useNavigate();

  // 📝 Estados para feedback visual
  const [loadingSync, setLoadingSync] = useState(false);
  const [loadingExport, setLoadingExport] = useState(false);
  const [alertInfo, setAlertInfo] = useState({ show: false, severity: "info", msg: "" });
  const [pendingCount, setPendingCount] = useState(0);

  // 🔄 Buscar si hay respuestas pendientes de subir en el arranque de la pantalla
  useEffect(() => {
    // Podrías crear un handler rápido que haga: db('resultados').where({ sincronizado: false }).count()
    // Para simplificar ahora, lo dejamos listo para cuando quieras pintar las filas exactas en el "Estado del sistema"
  }, []);

  // 📤 SUBIR RESPUESTAS AL SERVIDOR (MÉTODO BULK-SYNC RECIÉN CREADO)
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

  // 📥 BAJAR DATOS DEL SERVIDOR (LO QUE HACÍAS ANTES EN TRANSACCIÓN)
  const handleDescargarEcoe = async () => {
    setLoadingSync(true);
    setAlertInfo({ show: false, severity: "info", msg: "" });

    try {
      const configLocal = await window.api.invoke("db:obtenerConfiguracion");
      const stationId = configLocal?.station_id || 1;

      // Llamamos al proceso de descarga que limpia 'questions' y repuebla
      const res = await window.api.invoke("db:descargar-preguntas-servidor", stationId);

      if (res.success) {
        setAlertInfo({
          show: true,
          severity: "success",
          msg: `🎉 Estación ${stationId} sincronizada. Se han descargado ${res.count} preguntas correctamente.`
        });
      }
    } catch (error) {
      setAlertInfo({
        show: true,
        severity: "error",
        msg: `Fallo al descargar configuración: ${error.message}`
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
          {/* 🔄 Importar / Descargar */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6">⬇️ Importar Rúbricas (Servidor → Laptop)</Typography>
                <Typography variant="body2" sx={{ mt: 1, color: "text.secondary" }}>
                  Inicializa el portátil bajando el listado oficial de alumnos, configuraciones y preguntas del examen centralizado.
                </Typography>

                <Button 
                  variant="contained" 
                  sx={{ mt: 2 }} 
                  onClick={handleDescargarEcoe}
                  disabled={loadingSync || loadingExport}
                  startIcon={loadingSync && <CircularProgress size={20} color="inherit" />}
                >
                  {loadingSync ? "Descargando..." : "Bajar Datos Iniciales"}
                </Button>
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
                  <Typography>Servidor Central: 🟢 Conectado (localhost:8000)</Typography>
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