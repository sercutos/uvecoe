import React, { useEffect, useState } from 'react';
import { Alert, Box, IconButton, Tooltip, Menu, MenuItem, Modal, Typography, Button, Divider, Chip, CircularProgress } from '@mui/material';

// Importación de iconos
import HomeIcon from '@mui/icons-material/Home';
import SettingsIcon from '@mui/icons-material/Settings';
import PeopleIcon from '@mui/icons-material/People';
import QuizIcon from '@mui/icons-material/Quiz';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'; // Icono extra para el menú de ayuda
import InfoIcon from '@mui/icons-material/Info';               // Icono extra para el Acerca de
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import WifiOffIcon from '@mui/icons-material/WifiOff';

import { useNavigate, useLocation } from "react-router-dom";
import { getApiBaseUrl } from "../utils/apiConfig";
import { useServerOnline } from "../utils/connectivity";
import {
  clearServerAuthRequired,
  getServerToken,
  isAdminSession,
  isServerAuthRequired,
  markServerAuthRequired
} from "../utils/auth";
import ReauthDialog from "./ReauthDialog";

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

  // Estado de sincronización local -> servidor
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [needsReauth, setNeedsReauth] = useState(
    () => isServerAuthRequired() || !getServerToken()
  );
  const [reauthOpen, setReauthOpen] = useState(false);
  const [syncError, setSyncError] = useState(null);
  const [stationContext, setStationContext] = useState("");
  const serverOnline = useServerOnline();

  useEffect(() => {
    let active = true;

    const refreshPending = async () => {
      try {
        if (!window.api?.contarPendientes) return;
        const count = await window.api.contarPendientes();
        if (active) setPending(Number(count) || 0);
      } catch (error) {
        console.warn("[SYNC] No se pudo contar pendientes:", error);
      } finally {
        if (active) {
          setNeedsReauth(isServerAuthRequired() || !getServerToken());
        }
      }
    };

    const handleSyncError = (event) => {
      if (event?.detail) setSyncError(event.detail);
    };
    const handleSyncOk = () => setSyncError(null);

    refreshPending();
    const interval = setInterval(refreshPending, 10000);
    window.addEventListener("uvecoe:pending-changed", refreshPending);
    window.addEventListener("uvecoe:sync-error", handleSyncError);
    window.addEventListener("uvecoe:sync-ok", handleSyncOk);

    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener("uvecoe:pending-changed", refreshPending);
      window.removeEventListener("uvecoe:sync-error", handleSyncError);
      window.removeEventListener("uvecoe:sync-ok", handleSyncOk);
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadStationContext = async () => {
      try {
        const config = await window.api.obtenerConfiguracion();
        if (!active || !config) return;

        const org =
          config.organization_name ||
          (config.organization_id != null
            ? `Organización ${config.organization_id}`
            : "");
        const ecoe = config.ecoe_name || `ECOE ${config.ecoe_id}`;
        const station =
          config.station_name || `Estación ${config.station_id}`;

        setStationContext([org, ecoe, station].filter(Boolean).join(" · "));
      } catch (error) {
        console.warn(
          "[CONFIG] No se pudo leer el contexto de la estación:",
          error
        );
      }
    };

    loadStationContext();
    window.addEventListener("uvecoe:config-changed", loadStationContext);

    return () => {
      active = false;
      window.removeEventListener("uvecoe:config-changed", loadStationContext);
    };
  }, []);

  const syncNow = async () => {
    if (syncing) return;

    const token = getServerToken();
    if (!token) {
      markServerAuthRequired();
      setNeedsReauth(true);
      setReauthOpen(true);
      return;
    }

    setSyncing(true);
    setSyncError(null);

    try {
      const result = await window.api.sincronizarRespuestas(token);

      if (!result?.success) {
        if (result?.code === "unauthorized" || result?.status === 401) {
          markServerAuthRequired();
          setNeedsReauth(true);
          setSyncError(
            "La sesión del servidor ha caducado. Reconecta para subir las respuestas."
          );
        } else if (result?.code !== "sync_in_progress") {
          setSyncError(result?.error || "No se pudo sincronizar.");
        }
      } else {
        clearServerAuthRequired();
        setNeedsReauth(false);
      }
    } catch (error) {
      setSyncError(error.message || "No se pudo sincronizar.");
    } finally {
      setSyncing(false);
      try {
        const count = await window.api.contarPendientes();
        setPending(Number(count) || 0);
      } catch {
        // La siguiente consulta periódica lo actualizará.
      }
      setNeedsReauth(isServerAuthRequired() || !getServerToken());
    }
  };

  const handleSyncClick = async () => {
    if (syncing) return;

    if (needsReauth || !getServerToken()) {
      setReauthOpen(true);
      return;
    }

    await syncNow();
  };

  const handleReauthSuccess = () => {
    setSyncError(null);
    setNeedsReauth(false);
    syncNow();
  };

  // Manejadores del menú desplegable
  const handleProfileClick = (event) => setAnchorEl(event.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);

  const userEmail = sessionStorage.getItem("user_email") || "Usuario";

  const handleLogout = () => {
    const token = sessionStorage.getItem("token_ecoe");

    // Revocar el token en el servidor si hay conexión; si falla, no bloquea el logout.
    if (token) {
      fetch(`${getApiBaseUrl()}/backend/auth/tokens`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
      }).catch(() => {});
    }

    [
      "token_ecoe",
      "user_email",
      "user_role",
      "user_is_admin",
      "user_is_superadmin",
      "user_org_id",
      "user_org_name",
      "local_session",
      "token_expires_at",
      "sync_auth_required",
      "selected_date_string",
      "selected_round_id",
      "selected_round_code",
      "selected_shift_id",
      "selected_shift_code",
      "selected_planner_id",
      "todos_los_turnos"
    ].forEach((key) => sessionStorage.removeItem(key));

    // api_base_url se conserva para que el Login siga apuntando al servidor correcto.
    localStorage.removeItem("logged");
    navigate("/login");
  };

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

        {isAdminSession() && (
          <Tooltip title="Configuración">
            <IconButton onClick={() => navigate("/settings")} sx={getIconStyle("/settings")}>
              <SettingsIcon />
            </IconButton>
          </Tooltip>
        )}

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

        {/* CONTEXTO DE LA ESTACIÓN CONFIGURADA */}
        {stationContext && (
          <Tooltip title={stationContext}>
            <Typography
              variant="body2"
              color="text.secondary"
              noWrap
              sx={{
                minWidth: 0,
                maxWidth: 420,
                overflow: "hidden",
                textOverflow: "ellipsis",
                mr: 1
              }}
            >
              {stationContext}
            </Typography>
          </Tooltip>
        )}

        {/* ESTADO DE CONEXIÓN CON EL SERVIDOR */}
        {!serverOnline && (
          <Tooltip title="Sin conexión con el servidor. La app trabaja en modo offline y guarda las respuestas localmente.">
            <Chip
              size="small"
              icon={<WifiOffIcon />}
              label="Sin conexión"
              color="default"
              variant="filled"
              sx={{ mr: 1 }}
            />
          </Tooltip>
        )}

        {/* ESTADO DE SINCRONIZACIÓN */}
        <Tooltip
          title={
            needsReauth
              ? "Sesión del servidor no disponible. Pulsa para reconectar."
              : pending > 0
                ? "Respuestas pendientes. Pulsa para sincronizar."
                : "Todo sincronizado con el servidor"
          }
        >
          <Chip
            size="small"
            icon={
              syncing ? (
                <CircularProgress size={14} color="inherit" />
              ) : needsReauth ? (
                <CloudOffIcon />
              ) : pending > 0 ? (
                <CloudUploadIcon />
              ) : (
                <CloudDoneIcon />
              )
            }
            label={
              syncing
                ? "Sincronizando..."
                : needsReauth
                  ? pending > 0
                    ? `${pending} pendientes · Reconectar`
                    : "Reconectar"
                  : pending > 0
                    ? `${pending} pendientes`
                    : "Al día"
            }
            color={needsReauth ? "error" : pending > 0 ? "warning" : "success"}
            variant={needsReauth || pending > 0 ? "filled" : "outlined"}
            onClick={handleSyncClick}
            sx={{ mr: 1, cursor: "pointer" }}
          />
        </Tooltip>

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
              {userEmail}
            </Typography>
          </Box>
          <Divider />
          
          <MenuItem onClick={handleLogout}>
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

      {syncError && (
        <Alert
          severity="warning"
          onClose={() => setSyncError(null)}
          sx={{
            position: "fixed",
            top: 64,
            right: 16,
            zIndex: 1100,
            maxWidth: 420
          }}
        >
          {syncError}
        </Alert>
      )}

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
                Al finalizar todas las evaluaciones y cuando vuelvas a disponer de conexión a internet, pulsa el indicador de <strong>pendientes</strong> de la barra superior para enviar las respuestas guardadas. Si no puedes, pide a un administrador que lo haga desde Configuración.
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

      <ReauthDialog
        open={reauthOpen}
        onClose={() => setReauthOpen(false)}
        onSuccess={handleReauthSuccess}
      />
    </>
  );
}