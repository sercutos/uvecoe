import React, { useState } from 'react';
import { Box, IconButton, Tooltip, Menu, MenuItem, Modal, Typography, Button, Divider } from '@mui/material';

// Importación de iconos
import HomeIcon from '@mui/icons-material/Home';
import SettingsIcon from '@mui/icons-material/Settings';
import PeopleIcon from '@mui/icons-material/People';
import QuizIcon from '@mui/icons-material/Quiz';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'; // Icono extra para el menú de ayuda
import InfoIcon from '@mui/icons-material/Info';               // Icono extra para el Acerca de

import { useNavigate, useLocation } from "react-router-dom";

// Estilo base reutilizable para los modales estéticos de MUI
const modalStyle = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 450,
  bgcolor: 'background.paper',
  boxShadow: 24,
  p: 4,
  borderRadius: '12px',
  outline: 'none'
};

export default function Toolbar() {
  const navigate = useNavigate();
  const location = useLocation();

  // Estados para controlar el menú desplegable del usuario
  const [anchorEl, setAnchorEl] = useState(null);
  const openMenu = Boolean(anchorEl);

  // Estados para controlar la visibilidad de los modales
  const [openHelp, setOpenHelp] = useState(false);
  const [openAbout, setOpenAbout] = useState(false);

  // Manejadores del menú desplegable
  const handleProfileClick = (event) => setAnchorEl(event.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);

  const getIconStyle = (path) => {
    const isActive = location.pathname === path;
    return {
      color: isActive ? "#006687" : "rgba(0, 0, 0, 0.54)",
      backgroundColor: isActive ? "#d2e4ec" : "transparent",
      '&:hover': {
        backgroundColor: isActive ? "#b9d5e3" : "rgba(0, 0, 0, 0.04)"
      },
      borderRadius: "8px",
      transition: "all 0.2s ease"
    };
  };

  return (
    <>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
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

        <Box sx={{ flexGrow: 1 }} />

        {/* BOTÓN DE PERFIL/OPCIONES */}
        <Tooltip title="Opciones de usuario">
          <IconButton 
            onClick={handleProfileClick} 
            sx={getIconStyle("/login")} // Mantiene iluminación azul si estás en la página login
          >
            <AccountCircleIcon />
          </IconButton>
        </Tooltip>

        {/* MENÚ DESPLEGABLE DE PERFIL */}
        <Menu
          anchorEl={anchorEl}
          open={openMenu}
          onClose={handleMenuClose}
          onClick={handleMenuClose}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          PaperProps={{
            elevation: 3,
            sx: { borderRadius: '8px', mt: 1, minWidth: 180 }
          }}
        >
          <Box sx={{ px: 2, py: 1 }}>
            <Typography variant="caption" display="block" color="text.secondary">
              Conectado como:
            </Typography>
            <Typography variant="subtitle2" color="primary" sx={{ fontWeight: 'bold' }}>
              ecoe@umh.es
            </Typography>
          </Box>
          <Divider />
          
          <MenuItem onClick={() => { handleMenuClose(); navigate("/login"); }}>
            <AccountCircleIcon sx={{ mr: 1.5, color: 'action.active' }} /> Salir / Logout
          </MenuItem>

          <MenuItem onClick={() => { handleMenuClose(); setOpenHelp(true); }}>
            <HelpOutlineIcon sx={{ mr: 1.5, color: 'action.active' }} /> Ayuda
          </MenuItem>

          <MenuItem onClick={() => { handleMenuClose(); setOpenAbout(true); }}>
            <InfoIcon sx={{ mr: 1.5, color: 'action.active' }} /> Acerca de
          </MenuItem>
        </Menu>
      </Box>

      {/* ─── MODAL DE AYUDA ─── */}
      <Modal open={openHelp} onClose={() => setOpenHelp(false)}>
        <Box sx={modalStyle}>
          <Typography variant="h5" component="h2" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1, color: '#006687', fontWeight: 'bold' }}>
            ❓ Guía de Ayuda Local
          </Typography>
          <Divider sx={{ mb: 2 }} />
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>📶 Funcionamiento Offline</Typography>
              <Typography variant="body2" color="text.secondary">
                La aplicación guarda todas las respuestas de los exámenes localmente en el portátil de manera automática. No necesitas disponer de conexión a internet durante el transcurso de la evaluación.
              </Typography>
            </Box>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>🔄 Sincronizar al Servidor</Typography>
              <Typography variant="body2" color="text.secondary">
                Al finalizar todas las evaluaciones y cuando vuelvas a disponer de conexión a internet, entra en la sección de <strong>Configuración</strong> para enviar el lote de respuestas guardadas en SQLite hacia el servidor central.
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="contained" onClick={() => setOpenHelp(false)} sx={{ bgcolor: '#006687' }}>
              Entendido
            </Button>
          </Box>
        </Box>
      </Modal>

      {/* ─── MODAL ACERCA DE ─── */}
      <Modal open={openAbout} onClose={() => setOpenAbout(false)}>
        <Box sx={{ ...modalStyle, textAlign: 'center' }}>
          <Typography variant="h5" component="h2" sx={{ color: '#006687', fontWeight: 'bold', mb: 1 }}>
            UV-ECOE
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontStyle: 'italic' }}>
            Versión 1.0.0 (Build 2026)
          </Typography>
          <Divider sx={{ mb: 2 }} />
          
          <Typography variant="body1" sx={{ mb: 3 }}>
            Sistema de Evaluación Clínica Objetiva Estructurada en entorno local y de escritorio. Desarrollado para garantizar la resiliencia offline.
          </Typography>

          <Box sx={{ bgcolor: '#e8f4f8', p: 1.5, borderRadius: '8px', mb: 3, display: 'inline-block', width: '100%' }}>
            <Typography variant="body2" sx={{ color: '#006687', fontWeight: 'bold' }}>
              🟢 Base de Datos Local: Conectada (SQLite)
            </Typography>
          </Box>

          <Typography variant="caption" display="block" color="text.secondary" sx={{ mb: 3 }}>
            © 2026 Universitat de València / Facultad de Medicina y Odontología
          </Typography>

          <Button variant="outlined" onClick={() => setOpenAbout(false)} sx={{ color: '#006687', borderColor: '#006687' }}>
            Cerrar
          </Button>
        </Box>
      </Modal>
    </>
  );
}