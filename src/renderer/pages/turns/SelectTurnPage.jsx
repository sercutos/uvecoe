import React, { useState, useEffect } from "react";
import { CssBaseline, Container, Typography, Box } from "@mui/material";
import Grid from "@mui/material/Grid"; 
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import SyncIcon from '@mui/icons-material/Sync';
import LoginIcon from '@mui/icons-material/Login';
import Toolbar from "../../components/Toolbar";
import { useNavigate } from "react-router-dom";

export default function SelectTurnPage() {
  const navigate = useNavigate();
  const [turnosFiltrados, setTurnosFiltrados] = useState([]);

  // Recuperamos de la sesión el día que pulsó el usuario (ej: "11/05/2026")  
  const diaSeleccionado = sessionStorage.getItem("selected_date_string");

  useEffect(() => {
    // 1. Recuperamos los turnos totales que guardó la página anterior
    const turnosGuardados = sessionStorage.getItem("todos_los_turnos");
    
    if (turnosGuardados && diaSeleccionado) {
      const todosLosTurnos = JSON.parse(turnosGuardados);

      // 2. Filtramos para quedarnos SOLO con los turnos de ese día
      const filtrados = todosLosTurnos.filter(turno => {
        // 🚀 CORREGIDO: Tolerancia al modo online (time_start.$date) u offline (time_start)
        const timestamp = turno.time_start?.$date || turno.time_start;
        if (!timestamp) return false;

        const fechaTurno = new Date(timestamp).toLocaleDateString("es-ES", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric"
        });

        return fechaTurno === diaSeleccionado;
      });

      setTurnosFiltrados(filtrados);
    }
  }, [diaSeleccionado]);

  const handleSelectTurn = (turnoId, shiftCode) => {
    // Guardamos el ID del turno elegido para las siguientes pantallas (alumnos, etc.)
    sessionStorage.setItem("selected_shift_id", turnoId);
    sessionStorage.setItem("selected_shift_code", shiftCode || "ÚNICO");
    
    // Avanzamos a la pantalla de evaluación offline
    navigate("/evaluation"); 
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
            <Typography variant="body1" sx={{ fontWeight: "bold" }}>Turno</Typography>
          </Box>
          <Box sx={{ flexGrow: 1, height: "1px", backgroundColor: "#ddd", mx: 3 }} />
          <Typography variant="body1" sx={{ color: "rgba(0, 0, 0, 0.38)" }}>Evaluación</Typography>
        </Box>

        <Typography variant="h5" sx={{ mb: 4, fontWeight: "bold", color: "#333" }}>
          Turnos disponibles para el día {diaSeleccionado}:
        </Typography>

        {/* REJILLA DINÁMICA DE BOTONES DE TURNOS */}
        <Grid container spacing={3}>
          {turnosFiltrados.map((turno) => {
            // 🚀 CORREGIDO: Extraemos la fecha soportando la variación estructural online/offline
            const timestamp = turno.time_start?.$date || turno.time_start;
            const horaBonita = new Date(timestamp).toLocaleTimeString("es-ES", {
              hour: "2-digit",
              minute: "2-digit"
            });

            // Fallback elegante para el nombre/código del turno
            const codigoTurno = turno.shift_code || "Único Offline";

            return (
              <Grid item xs={12} sm={4} key={turno.id}>
                <button
                  onClick={() => handleSelectTurn(turno.id, turno.shift_code)}
                  style={{
                    width: "100%",
                    backgroundColor: "#0288d1", 
                    border: "none",
                    outline: "none",
                    color: "#fff",
                    fontSize: "1.2rem",
                    fontWeight: "bold",
                    padding: "20px 0",
                    borderRadius: "12px",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "4px",
                    transition: "background-color 0.2s"
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#01579b"}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#0288d1"}
                >
                  <span>Turno {codigoTurno}</span>
                  <span style={{ fontSize: "0.9rem", fontWeight: "normal", opacity: 0.9 }}>
                    🕒 {horaBonita} hs
                  </span>
                </button>
              </Grid>
            );
          })}

          {turnosFiltrados.length === 0 && (
            <Typography variant="body1" sx={{ width: "100%", textAlign: "center", mt: 4, color: "text.secondary" }}>
              No se encontraron turnos asignados a este día.
            </Typography>
          )}
        </Grid>

      </Container>
    </React.Fragment>
  );
}