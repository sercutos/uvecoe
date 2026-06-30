import React, { useState, useEffect } from "react";
import { CssBaseline, Container, Typography, Box, CircularProgress } from "@mui/material";
import Grid from "@mui/material/Grid";
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import SyncIcon from '@mui/icons-material/Sync';
import LoginIcon from '@mui/icons-material/Login';
import Toolbar from "../../components/Toolbar";
import { useNavigate } from "react-router-dom";
import { fetchWithAuth } from "../../utils/api";

export default function SelectRoundPage() {
  const navigate = useNavigate();
  const [rondas, setRondas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Recuperamos el día visual seleccionado en la pantalla anterior
  const diaSeleccionado = sessionStorage.getItem("selected_date_string");

  useEffect(() => {
    const cargarRondas = async () => {
      try {
        setLoading(true);

        // 1. 🚀 OBTENER EL ECOE_ID DINÁMICO DESDE SQLITE LOCAL
        const configLocal = await window.api.obtenerConfiguracion();
        const ecoeId = configLocal?.ecoe_id;

        if (!ecoeId) {
          throw new Error("El terminal no está configurado. Por favor, inicialice el equipo.");
        }

        try {
          // 2. INTENTO ONLINE: Obtener rondas de FastAPI
          console.log(`[ROUNDS] Cargando rondas online para ECOE ID: ${ecoeId}...`);
          const data = await fetchWithAuth(`http://localhost:8000/backend/api/v1/rounds?ecoe_id=${ecoeId}`);
          
          // Soporte si la API devuelve directamente array o un objeto paginado .items
          const listaRondas = data.items || data || [];
          setRondas(listaRondas);
          
        } catch (onlineError) {
          // 3. 🚀 MODO CONTINGENCIA OFFLINE
          console.warn("[ROUNDS] Servidor no disponible. Generando ronda de contingencia local...", onlineError.message);
          
          // Generamos una ronda por defecto para que la app no se detenga sin red
          setRondas([
            {
              id: 1,
              round_code: "R-LOCAL",
              description: "Ronda Única Offline"
            }
          ]);
        }

      } catch (err) {
        console.error("[ROUNDS] Error crítico:", err);
        setError(err.message || "No se pudieron cargar las rondas del examen.");
      } finally {
        setLoading(false);
      }
    };

    cargarRondas();
  }, []);

  const handleSelectRound = (roundId, roundCode) => {
    sessionStorage.setItem("selected_round_id", roundId);
    sessionStorage.setItem("selected_round_code", roundCode);
    navigate("/turns"); // Siguiente paso
  };

  return (
    <React.Fragment>
      <CssBaseline />
      <Toolbar />
      <Container maxWidth="lg" sx={{ mt: 12 }}>
        
        {/* INDICADOR DE PASOS */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 6, px: 2 }}>
          <Box display="flex" alignItems="center" gap={1} sx={{ color: "rgba(0, 0, 0, 0.38)" }}>
            <CalendarMonthIcon />
            <Typography variant="body1">Fecha ({diaSeleccionado})</Typography>
          </Box>
          <Box sx={{ flexGrow: 1, height: "1px", backgroundColor: "#ddd", mx: 3 }} />
          <Box display="flex" alignItems="center" gap={1} sx={{ color: "#006687" }}>
            <SyncIcon />
            <Typography variant="body1" sx={{ fontWeight: "bold" }}>Ronda</Typography>
          </Box>
          <Box sx={{ flexGrow: 1, height: "1px", backgroundColor: "#ddd", mx: 3 }} />
          <Box display="flex" alignItems="center" gap={1} sx={{ color: "rgba(0, 0, 0, 0.38)" }}>
            <LoginIcon />
            <Typography variant="body1">Turno</Typography>
          </Box>
        </Box>

        <Typography variant="h5" sx={{ mb: 4, fontWeight: "bold", color: "#333" }}>
          Selecciona la Ronda para el día {diaSeleccionado}:
        </Typography>

        {/* FEEDBACK DE CARGA Y ERROR */}
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

        {/* REJILLA DINÁMICA DE BOTONES DE RONDAS */}
        {!loading && !error && (
          <Grid container spacing={3}>
            {rondas.map((ronda) => (
              <Grid item xs={12} sm={6} key={ronda.id}>
                <button
                  onClick={() => handleSelectRound(ronda.id, ronda.round_code)}
                  style={{
                    width: "100%",
                    backgroundColor: "#ffb74d",
                    border: "none",
                    outline: "none",
                    color: "#fff",
                    fontSize: "1.3rem",
                    fontWeight: "bold",
                    padding: "24px 0",
                    borderRadius: "12px",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "4px",
                    transition: "background-color 0.2s"
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#f57c00"}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#ffb74d"}
                >
                  <span>{ronda.description}</span>
                  <span style={{ fontSize: "0.9rem", fontWeight: "normal", opacity: 0.85 }}>
                    Código: {ronda.round_code}
                  </span>
                </button>
              </Grid>
            ))}

            {rondas.length === 0 && (
              <Typography variant="body1" sx={{ width: "100%", textAlign: "center", mt: 4, color: "text.secondary" }}>
                No hay rondas disponibles para esta ECOE.
              </Typography>
            )}
          </Grid>
        )}

      </Container>
    </React.Fragment>
  );
}