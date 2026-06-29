import React from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';

// Importación de iconos corregidos y estilizados
import HomeIcon from '@mui/icons-material/Home';
import SettingsIcon from '@mui/icons-material/Settings';      // Ideal para Configuración (Settings)
import PeopleIcon from '@mui/icons-material/People';          // Ideal para la lista de Alumnos (Students)
import QuizIcon from '@mui/icons-material/Quiz';              // Ideal para el banco de Preguntas (Questions)
import FactCheckIcon from '@mui/icons-material/FactCheck';    // Perfecto para el formulario de Evaluación/Respuestas
import AccountCircleIcon from '@mui/icons-material/AccountCircle'; // Ideal para el perfil/Login

import { useNavigate, useLocation } from "react-router-dom";

export default function Toolbar() {
  const navigate = useNavigate();
  const location = useLocation(); // Nos permite saber en qué página estamos para iluminar el icono activo

  // Función auxiliar para darle un color diferente al icono de la página actual (UX)
  const getIconStyle = (path) => {
    const isActive = location.pathname === path;
    return {
      color: isActive ? "#006687" : "rgba(0, 0, 0, 0.54)", // Azul corporativo si está activo, gris si no
      backgroundColor: isActive ? "#d2e4ec" : "transparent", // Fondo suave si está activo
      '&:hover': {
        backgroundColor: isActive ? "#b9d5e3" : "rgba(0, 0, 0, 0.04)"
      },
      borderRadius: "8px",
      transition: "all 0.2s ease"
    };
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1, // Añade una pequeña separación uniforme entre los iconos
        padding: '8px 16px',
        backgroundColor: '#f5f5f5',
        borderBottom: '1px solid #ddd',
        position: 'fixed',
        top: 0,
        width: '100%',
        zIndex: 1000
      }}
    >
      <Tooltip title="Inicio">
        <IconButton onClick={() => navigate("/")} sx={getIconStyle("/")}>
          <HomeIcon />
        </IconButton>
      </Tooltip>

      <Tooltip title="Configuración">
        <IconButton onClick={() => navigate("/settings")} sx={getIconStyle("/settings")}>
          <SettingsIcon />
        </IconButton>
      </Tooltip>

      <Tooltip title="Alumnos">
        <IconButton onClick={() => navigate("/students")} sx={getIconStyle("/students")}>
          <PeopleIcon />
        </IconButton>
      </Tooltip>

      <Tooltip title="Banco de Preguntas">
        <IconButton onClick={() => navigate("/questions")} sx={getIconStyle("/questions")}>
          <QuizIcon />
        </IconButton>
      </Tooltip>

      <Tooltip title="Evaluación Activa">
        <IconButton onClick={() => navigate("/evaluation")} sx={getIconStyle("/evaluation")}>
          <FactCheckIcon />
        </IconButton>
      </Tooltip>

      {/* Empujamos el Login al extremo derecho para limpiar el menú principal (Opcional, queda súper elegante) */}
      <Box sx={{ flexGrow: 1 }} />

      <Tooltip title="Iniciar Sesión / Perfil">
        <IconButton onClick={() => navigate("/login")} sx={getIconStyle("/login")}>
          <AccountCircleIcon />
        </IconButton>
      </Tooltip>
    </Box>
  );
}