import React, { useState } from "react";
import { Paper, Box, Typography, TextField, Button, InputAdornment } from "@mui/material";
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import LockIcon from '@mui/icons-material/Lock';


import logoImg from "../../../assets/images/logo1.png"; 

export default function Login({ onLogin }) {

/*
{
  "email": "ecoe@umh.es",
  "password": "Kui0chee"
}
*/

  const [email, setEmail] = useState("ecoe@umh.es");
  const [password, setPassword] = useState("Kui0chee");


const handleSubmit = async (e) => {
  e.preventDefault();
  
  try {
    console.log("[LOGIN] Intentando autenticación online con FastAPI...");

    // 1. INTENTO ONLINE ORIGINAL
    const response = await fetch("http://localhost:8000/backend/auth/tokens", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: email,
        password: password
      })
    });

    // Si el servidor responde pero da un error de credenciales reales (401, 403, etc.)
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("[LOGIN] Error en autenticación online:", response.status, errorData);
      throw new Error("Usuario o contraseña incorrectos en el servidor.");
    }

    const data = await response.json();
    console.log("[LOGIN] Respuesta exitosa de FastAPI:", data);
    
    if (data.token) {
      // A) Guardamos el token en el navegador para las llamadas de red mientras dure la sesión
      sessionStorage.setItem("token_ecoe", data.token);

      // B) 🚀 RESPALDO LOCAL: Guardamos al usuario en SQLite para que pueda entrar mañana sin internet
      console.log("[LOGIN] Sincronizando usuario en la base de datos SQLite local...");
      const usuarioLocal = {
        id: data.user_id || Date.now(), // Asegúrate del campo de tu API (data.user_id, data.id, etc.)
        email: email,
        role: data.role || "evaluador",
        token: data.token
      };
      await window.api.guardarUsuarioLocal(usuarioLocal);

      console.log("[LOGIN] ¡Token y perfil local sincronizados!");
      if (onLogin) onLogin();
    } else {
      throw new Error("El servidor no devolvió el parámetro 'token'.");
    }

  } catch (error) {
    // 2. 🚀 MODO CONTINGENCIA OFFLINE
    console.warn("[LOGIN] FastAPI no disponible o error detectado. Iniciando protocolo Offline...", error.message);

    // Si el error fue explícitamente que la clave está mal contra el servidor online, no entramos en offline
    if (error.message.includes("incorrectos en el servidor")) {
      alert("No se pudo iniciar sesión: " + error.message);
      return;
    }

    try {
      // Consultamos a la base de datos local de Knex a través de nuestro puente IPC
      const usuarioLocal = await window.api.obtenerUsuarioLocal(email);

      if (usuarioLocal) {
        console.log("[LOGIN OFFLINE] Usuario encontrado en SQLite local:", usuarioLocal);
        
        // Generamos un token ficticio local para engañar a los PrivateRoute de React Router
        // y permitir que la app funcione sin internet de manera transparente
        sessionStorage.setItem("token_ecoe", usuarioLocal.token_temporal || "offline_token_session");
        
        alert("⚠️ Modo Offline activado: Accediendo con credenciales locales guardadas.");
        
        if (onLogin) onLogin();
      } else {
        console.error("[LOGIN OFFLINE] El usuario no existe en la base de datos local.");
        alert("Error de conexión: El portátil está Offline y este usuario no ha sido sincronizado previamente en este equipo.");
      }
    } catch (dbError) {
      console.error("[LOGIN OFFLINE] Error crítico consultando la DB local:", dbError);
      alert("No se pudo conectar al servidor ni verificar las credenciales locales.");
    }
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
            Iniciar Sesión
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}