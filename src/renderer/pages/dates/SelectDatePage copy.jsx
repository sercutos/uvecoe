import React from "react";
import { CssBaseline, Container, Typography, Box } from "@mui/material";
import Grid from "@mui/material/Grid"; // 🚀 Forzamos el uso de Grid v2 de MUI v6
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import SyncIcon from '@mui/icons-material/Sync';
import LoginIcon from '@mui/icons-material/Login';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import Toolbar from "../../components/Toolbar";
import { useNavigate } from "react-router-dom";

export default function SelectDatePage() {
  const navigate = useNavigate();

  const fechasDisponibles = [
    { id: "f1", texto: "lun, 25 may" },
    { id: "f2", texto: "mar, 26 may" },
    { id: "f3", texto: "mié, 27 may" },
    { id: "f4", texto: "jue, 28 may" }
  ];

  const handleSelectDate = (dateId) => {
    navigate("/turns");
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
            <Typography variant="body1">Ronda 1</Typography>
          </Box>
          <Box sx={{ flexGrow: 1, height: "1px", backgroundColor: "#ddd", mx: 3 }} />
          <Box display="flex" alignItems="center" gap={1} sx={{ color: "rgba(0, 0, 0, 0.38)" }}>
            <LoginIcon />
            <Typography variant="body1">Estación 1</Typography>
          </Box>
          <Box sx={{ flexGrow: 1, height: "1px", backgroundColor: "#ddd", mx: 3 }} />
          <Box display="flex" alignItems="center" gap={1} sx={{ color: "rgba(0, 0, 0, 0.38)" }}>
            <AccessTimeIcon />
            <Typography variant="body1">Turno</Typography>
          </Box>
        </Box>

        {/* REJILLA DE TARJETAS MODERNA (Grid 2) */}
        <Grid container spacing={3}>
          {fechasDisponibles.map((fecha) => (
            <Grid size={{ xs: 12, sm: 6 }} key={fecha.id}>
              <button
                onClick={() => handleSelectDate(fecha.id)}
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
                {fecha.texto}
              </button>
            </Grid>
          ))}
        </Grid>

      </Container>
    </React.Fragment>
  );
}