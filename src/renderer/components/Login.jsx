import React, { useState } from "react";
import { Paper, Box, Typography, TextField, Button, InputAdornment } from "@mui/material";
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import LockIcon from '@mui/icons-material/Lock';
import bcrypt from "bcryptjs";

import logoImg from "../../../assets/images/logo1.png";
import { getApiBaseUrl } from "../utils/apiConfig";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loginOffline = async (motivo) => {
    console.warn("[LOGIN OFFLINE] Motivo:", motivo);

    try {
      const emailLimpio = email.trim().toLowerCase();
      const usuarioLocal = await window.api.obtenerUsuarioLocal(emailLimpio);

      if (!usuarioLocal) {
        alert(
          "Error de conexión: el portátil está Offline y este usuario no ha sido sincronizado previamente en este equipo."
        );
        return;
      }

      if (!usuarioLocal.password_hash) {
        alert(
          "Este usuario no tiene credenciales offline en este equipo. Inicie sesión una vez con conexión a internet."
        );
        return;
      }

      const passwordOk = await bcrypt.compare(
        password,
        usuarioLocal.password_hash
      );

      if (!passwordOk) {
        alert("Contraseña incorrecta.");
        return;
      }

      sessionStorage.setItem(
        "token_ecoe",
        usuarioLocal.token_temporal || "offline_token_session"
      );
      sessionStorage.setItem("user_email", emailLimpio);

      alert(
        "⚠️ Modo Offline activado: Accediendo con credenciales locales guardadas."
      );

      if (onLogin) onLogin();
    } catch (dbError) {
      console.error("[LOGIN OFFLINE] Error crítico consultando la DB local:", dbError);
      alert("No se pudo conectar al servidor ni verificar las credenciales locales.");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (submitting) return;
    setSubmitting(true);

    try {
      console.log("[LOGIN] Intentando autenticación online con FastAPI...");

      const emailLimpio = email.trim().toLowerCase();
      let response;

      try {
        response = await fetch(`${getApiBaseUrl()}/backend/auth/tokens`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            email: emailLimpio,
            password: password
          })
        });
      } catch (networkError) {
        // Sin red: intentamos validar localmente.
        await loginOffline(networkError.message);
        return;
      }

      // Credenciales incorrectas: no permitimos el bypass offline.
      if (response.status === 401 || response.status === 403) {
        const errorData = await response.json().catch(() => ({}));
        console.error(
          "[LOGIN] Error de credenciales:",
          response.status,
          errorData
        );
        alert("Usuario o contraseña incorrectos en el servidor.");
        return;
      }

      if (!response.ok) {
        // 500/502...: el servidor no está operativo, probamos offline.
        console.warn(
          `[LOGIN] Servidor respondió ${response.status}. Probando modo offline...`
        );
        await loginOffline(`HTTP ${response.status}`);
        return;
      }

      const data = await response.json();

      if (!data.token) {
        console.warn(
          "[LOGIN] El servidor no devolvió token. Probando modo offline..."
        );
        await loginOffline("Respuesta sin token");
        return;
      }

      sessionStorage.setItem("token_ecoe", data.token);
      sessionStorage.setItem("user_email", emailLimpio);

      // Guardamos un hash de la contraseña para poder validar el login offline.
      try {
        const passwordHash = await bcrypt.hash(password, 10);

        await window.api.guardarUsuarioLocal({
          id: data.user_id || data.id || Date.now(),
          email: emailLimpio,
          role: data.role || "evaluador",
          token: data.token,
          password_hash: passwordHash
        });

        console.log("[LOGIN] Token y credenciales offline sincronizados.");
      } catch (dbError) {
        console.warn(
          "[LOGIN] No se pudo guardar el usuario local; el login online continúa:",
          dbError
        );
      }

      if (onLogin) onLogin();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box 
      sx={{ 
        backgroundColor: "#f4f6f8", 
        minHeight: "100vh", 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center",
        width: "100%"
      }}
    >
      <Paper 
        elevation={4} 
        sx={{ 
          p: 4, 
          display: "flex", 
          flexDirection: "column", 
          alignItems: "center",
          borderRadius: "12px",
          maxWidth: "400px",
          width: "100%",
          mx: 2
        }}
      >
        
        {/* ================= EL LOGO REAL CORREGIDO ================= */}
        <Box sx={{ mb: 3, mt: 1, display: "flex", justifyContent: "center" }}>
          <img 
            src={logoImg} 
            alt="Logo UVECOE" 
            style={{ 
              width: "170px",      // Controla el tamaño exacto aquí
              height: "auto", 
              objectFit: "contain" 
            }} 
          />
        </Box>

        <Typography variant="body2" color="textSecondary" sx={{ mb: 4, textAlign: "center" }}>
          Por favor, introduzca sus credenciales para acceder a las estaciones de evaluación.
        </Typography>

        <Box component="form" onSubmit={handleSubmit} sx={{ width: "100%" }}>
          <TextField
            variant="outlined"
            margin="normal"
            required
            fullWidth
            id="email"
            label="Usuario / Email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <AccountCircleIcon color="action" />
                </InputAdornment>
              ),
            }}
          />
          <TextField
            variant="outlined"
            margin="normal"
            required
            fullWidth
            name="password"
            label="Contraseña"
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <LockIcon color="action" />
                </InputAdornment>
              ),
            }}
            sx={{ mb: 4 }}
          />

          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            disabled={submitting}
            sx={{ 
              backgroundColor: "#1976d2",
              '&:hover': { backgroundColor: "#115293" },
              fontWeight: "bold",
              py: 1.5,
              borderRadius: "8px",
              textTransform: "none",
              fontSize: "1.1rem",
              boxShadow: "none"
            }}
          >
            {submitting ? "Iniciando sesión..." : "Iniciar Sesión"}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}