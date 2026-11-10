import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, HashRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import App from "./App"; // 🚀 Guardián de inicialización

import FirstRunSetup from "./pages/setup/FirstRunSetup";
import Loginpage from "./pages/login/login";
import SelectDatePage from "./pages/dates/SelectDatePage";
import SelectRoundPage from "./pages/rounds/SelectRoundPage";
import SelectTurnPage from "./pages/turns/SelectTurnPage";

import Settings from "./pages/settings/settings";
import Students from "./pages/students/students";
import Evaluation from "./pages/evaluation/evaluation";

import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  Box,
  CircularProgress,
  Typography
} from "@mui/material";

import { initApiConfig } from "./utils/apiConfig";

const theme = createTheme({
  palette: {
    mode: "light"
  }
});

// file:// (app empaquetada) necesita HashRouter; BrowserRouter no puede
// resolver rutas sobre el pathname .../dist/index.html.
const Router = window.location.protocol === "file:" ? HashRouter : BrowserRouter;

function PrivateRoute({ children }) {
  const hasToken = sessionStorage.getItem("token_ecoe") !== null;
  return hasToken ? children : <Navigate to="/login" />;
}

// Inicializa la URL del servidor ANTES de renderizar cualquier pantalla,
// incluido el Login. Si no, tras reiniciar se usaría el fallback localhost.
function Bootstrap() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [setupCompleted, setSetupCompleted] = useState(null);

  useEffect(() => {
    let active = true;

    const initialize = async () => {
      try {
        await initApiConfig();

        let flag = null;

        try {
          flag = await window.api.getSetting("setup_completed");
        } catch (error) {
          console.warn("[SETUP] No se pudo leer setup_completed:", error);
        }

        // Compatibilidad con DBs antiguas que aún no tienen la marca.
        if (flag === undefined || flag === null) {
          try {
            const config = await window.api.obtenerConfiguracion();
            flag = config ? "true" : "false";
          } catch {
            flag = "false";
          }
        }

        if (active) setSetupCompleted(flag === "true");
      } catch (error) {
        console.warn("[SETUP] Error inicializando la aplicación:", error);
        if (active) setSetupCompleted(false);
      } finally {
        if (active) setReady(true);
      }
    };

    initialize();

    return () => {
      active = false;
    };
  }, []);

  if (!ready || setupCompleted === null) {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          gap: 2
        }}
      >
        <CircularProgress />
        <Typography variant="body1">
          Cargando configuración del terminal...
        </Typography>
      </Box>
    );
  }

  if (!setupCompleted) {
    return (
      <FirstRunSetup
        onComplete={() => {
          setSetupCompleted(true);
          navigate("/", { replace: true });
        }}
      />
    );
  }

  return (
    <Routes>
      {/* 1. El Login se queda totalmente libre por fuera */}
      <Route path="/login" element={<Loginpage />} />

      {/* 2. Las rutas operativas pasan por el Token y luego por el chequeo de SQLite de <App> */}
      <Route path="/" element={<PrivateRoute><App><SelectDatePage /></App></PrivateRoute>} />
      <Route path="/rounds" element={<PrivateRoute><App><SelectRoundPage /></App></PrivateRoute>} />
      <Route path="/turns" element={<PrivateRoute><App><SelectTurnPage /></App></PrivateRoute>} />

      <Route path="/settings" element={<PrivateRoute><App><Settings /></App></PrivateRoute>} />
      <Route path="/evaluation" element={<PrivateRoute><App><Evaluation /></App></PrivateRoute>} />
      <Route path="/students" element={<PrivateRoute><App><Students /></App></PrivateRoute>} />
    </Routes>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <Router>
      <Bootstrap />
    </Router>
  </ThemeProvider>
);
