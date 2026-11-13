import React, { useState } from "react";
import { Paper, Box, Typography, TextField, Button, InputAdornment } from "@mui/material";
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import LockIcon from '@mui/icons-material/Lock';
import bcrypt from "bcryptjs";

import logoImg from "../../../assets/images/logo1.png";
import {
  fetchCurrentUser,
  isServerAuthRequired,
  loginOnline,
  persistLogin,
  saveServerToken,
  saveUserSession
} from "../utils/auth";
import { setServerOnline } from "../utils/connectivity";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loginOffline = async (motivo) => {
    console.warn("[LOGIN OFFLINE] Motivo:", motivo);
    setServerOnline(false);

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

      const expiracion = usuarioLocal.token_expires_at
        ? new Date(usuarioLocal.token_expires_at)
        : null;
      const tokenCaducado =
        expiracion instanceof Date &&
        !Number.isNaN(expiracion.getTime()) &&
        expiracion <= new Date();

      const tokenGuardado =
        tokenCaducado ||
        usuarioLocal.token_temporal === "offline_token_session"
          ? null
          : usuarioLocal.token_temporal || null;

      saveServerToken(
        tokenGuardado,
        tokenCaducado ? null : usuarioLocal.token_expires_at || null
      );
      saveUserSession({ ...usuarioLocal, email: emailLimpio });

      alert(
        tokenCaducado
          ? "⚠️ Modo Offline activado. La sesión del servidor ha caducado: cuando vuelvas a tener conexión, pulsa 'Reconectar' para sincronizar."
          : isServerAuthRequired()
            ? "⚠️ Modo Offline activado: puedes evaluar, pero necesitarás reconectar para sincronizar."
            : "⚠️ Modo Offline activado: Accediendo con credenciales locales guardadas."
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

    const emailLimpio = email.trim().toLowerCase();

    try {
      console.log("[LOGIN] Intentando autenticación online con FastAPI...");

      const data = await loginOnline(emailLimpio, password);
      setServerOnline(true);

      // /auth/tokens no devuelve rol ni organización: los leemos de /users/me.
      let usuarioRemoto = null;
      try {
        usuarioRemoto = await fetchCurrentUser(data.token);
      } catch (meError) {
        console.warn("[LOGIN] No se pudo leer /users/me:", meError.message);
      }

      await persistLogin({
        token: data.token,
        expiration: data.expiration,
        me: usuarioRemoto,
        email: emailLimpio,
        password
      });

      console.log("[LOGIN] Token y credenciales offline sincronizados.");
      if (onLogin) onLogin();
    } catch (error) {
      // Credenciales incorrectas: no permitimos el bypass offline.
      if (error.status === 401 || error.status === 403) {
        console.error("[LOGIN] Error de credenciales:", error.status);
        alert("Usuario o contraseña incorrectos en el servidor.");
        return;
      }

      // Sin red, 5xx o respuesta sin token: validamos localmente.
      console.warn(
        `[LOGIN] Servidor no disponible (${error.message}). Probando modo offline...`
      );
      await loginOffline(error.message);
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