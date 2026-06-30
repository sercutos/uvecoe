import React, { useState, useEffect } from "react";
import { CssBaseline, Container, Typography, Box, CircularProgress } from "@mui/material";
import Grid from "@mui/material/Grid"; 
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import SyncIcon from '@mui/icons-material/Sync';
import LoginIcon from '@mui/icons-material/Login';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import Toolbar from "../../components/Toolbar";
import { useNavigate } from "react-router-dom";
import { fetchWithAuth } from "../../utils/api"; 

export default function SelectDatePage() {
  const navigate = useNavigate();
  
  const [diasDisponibles, setDiasDisponibles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const cargarFechas = async () => {
      try {
        setLoading(true);
        let turnos = [];

        // 1. 🚀 OBTENER EL ECOE_ID DINÁMICO DESDE SQLITE LOCAL
        const configLocal = await window.api.obtenerConfiguracion();
        const ecoeId = configLocal?.ecoe_id;

        if (!ecoeId) {
          throw new Error("El terminal no está configurado. Por favor, inicialice el equipo.");
        }

        try {
          // 2. INTENTO ONLINE: Consumir turnos de FastAPI
          console.log(`[FECHAS] Solicitando turnos online para ECOE ID: ${ecoeId}...`);
          const data = await fetchWithAuth(`http://localhost:8000/backend/api/v1/shifts?id_ecoe=${ecoeId}`);
          turnos = data.items || data || [];
          console.log("[FECHAS] Datos de turnos obtenidos de la API.");
        } catch (onlineError) {
          // 3. 🚀 MODO CONTINGENCIA OFFLINE: Si la red cae, simulamos o extraemos del entorno local
          console.warn("[FECHAS] Servidor no alcanzable. Generando fechas en modo de contingencia...", onlineError.message);
          
          // Fallback inteligente: Generamos el día de hoy como fecha del examen para que el evaluador no se quede bloqueado
          const hoy = new Date();
          turnos = [{
            id: 999,
            time_start: { $date: hoy.toISOString() },
            name: "Turno Único de Contingencia"
          }];
        }

        // Guardamos todos los turnos resultantes en caché de sesión para las siguientes pantallas
        sessionStorage.setItem("todos_los_turnos", JSON.stringify(turnos));

        // 4. Agrupamos y extraemos días únicos usando el timestamp de time_start.$date
        const diasMapeados = turnos.map(item => {
          const timestamp = item.time_start?.$date || item.time_start; // Tolerancia a formatos
          if (!timestamp) return null;

          const fechaObj = new Date(timestamp);
          
          // Formato legible: "30/06/2026"
          const formatoDia = fechaObj.toLocaleDateString("es-ES", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
          });

          // Formato visual más bonito para el botón: "Martes, 30 de Junio"
          const textoBonito = fechaObj.toLocaleDateString("es-ES", {
            weekday: "long",
            day: "numeric",
            month: "long"
          });

          return {
            id_dia: formatoDia, 
            texto: textoBonito.charAt(0).toUpperCase() + textoBonito.slice(1)
          };
        }).filter(Boolean);

        // 5. Filtramos duplicados
        const diasUnicos = [];
        const mapeoControl = new Set();
        
        diasMapeados.forEach(dia => {
          if (!mapeoControl.has(dia.id_dia)) {
            mapeoControl.add(dia.id_dia);
            diasUnicos.push(dia);
          }
        });

        setDiasDisponibles(diasUnicos);
      } catch (err) {
        console.error(err);
        setError(err.message || "No se pudieron cargar las fechas del examen.");
      } finally {
        setLoading(false);
      }
    };

    cargarFechas();
  }, []);

  const handleSelectDate = (dateId) => {
    sessionStorage.setItem("selected_date_string", dateId);
    navigate("/rounds"); // Siguiente paso
  };

  return (
    <React.Fragment>
      <CssBaseline />
      <Toolbar />
      <Container maxWidth="lg" sx={{ mt: 12 }}>
        
        {/* INDICADOR DE PASOS */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 6, px: 2 }}>
          <Box display="flex" alignItems="center" gap={1} sx={{ color: "#006687" }}>
            <CalendarMonthIcon />
            <Typography variant="body1" sx={{ fontWeight: "bold" }}>Fecha</Typography>
          </Box>
          <Box sx={{ flexGrow: 1, height: "1px", backgroundColor: "#ddd", mx: 3 }} />
          <Box display="flex" alignItems="center" gap={1} sx={{ color: "rgba(0, 0, 0, 0.38)" }}>
            <SyncIcon />
            <Typography variant="body1">Ronda</Typography>
          </Box>
          <Box sx={{ flexGrow: 1, height: "1px", backgroundColor: "#ddd", mx: 3 }} />
          <Box display="flex" alignItems="center" gap={1} sx={{ color: "rgba(0, 0, 0, 0.38)" }}>
            <LoginIcon />
            <Typography variant="body1">Estación</Typography>
          </Box>
          <Box sx={{ flexGrow: 1, height: "1px", backgroundColor: "#ddd", mx: 3 }} />
          <Box display="flex" alignItems="center" gap={1} sx={{ color: "rgba(0, 0, 0, 0.38)" }}>
            <AccessTimeIcon />
            <Typography variant="body1">Turno</Typography>
          </Box>
        </Box>

        {/* MANEJO DE ESTADOS DE CARGA Y ERROR */}
        {loading && (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
            <CircularProgress color="primary" />
          </Box>
        )}

        {error && (
          <Box bgcolor="#ffebee" p={3} borderRadius="8px" textAlign="center">
            <Typography color="error" variant="h6">{error}</Typography>
          </Box>
        )}

        {/* REJILLA DE TARJETAS DINÁMICA DE DÍAS */}
        {!loading && !error && (
          <Grid container spacing={3}>
            {diasDisponibles.map((dia) => (
              <Grid item xs={12} sm={6} key={dia.id_dia}>
                <button
                  onClick={() => handleSelectDate(dia.id_dia)}
                  style={{
                    width: "100%",
                    backgroundColor: "#66bb6a",
                    border: "none",
                    outline: "none",
                    color: "#fff",
                    fontSize: "1.3rem",
                    fontWeight: "bold",
                    padding: "24px 0",
                    borderRadius: "12px",
                    cursor: "pointer",
                    transition: "background-color 0.2s"
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#4caf50"}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#66bb6a"}
                >
                  {dia.texto}
                </button>
              </Grid>
            ))}
            {diasDisponibles.length === 0 && (
              <Typography variant="body1" sx={{ width: "100%", textAlign: "center", mt: 4, color: "text.secondary" }}>
                No hay fechas disponibles registradas para esta ECOE.
              </Typography>
            )}
          </Grid>
        )}

      </Container>
    </React.Fragment>
  );
}