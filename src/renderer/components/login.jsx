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
      console.log("[LOGIN] Enviando credenciales a FastAPI...");

      // 🚀 VOLVEMOS AL FORMATO JSON QUE TU BACKEND REQUIERE:
      const response = await fetch("http://localhost:8000/backend/auth/tokens", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email,       // Enviamos 'email' tal cual espera tu API
          password: password
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("[LOGIN] Error en autenticación:", response.status, errorData);
        throw new Error("Usuario o contraseña incorrectos.");
      }

      const data = await response.json();
      console.log("[LOGIN] Respuesta exitosa del backend:", data);
      
      // 🚀 CAPTURAMOS LA CLAVE CORRECTA: 'data.token'
      if (data.token) {
        sessionStorage.setItem("token_ecoe", data.token);
        console.log("[LOGIN] ¡Token guardado correctamente en sessionStorage!");
        if (onLogin) onLogin(); // Avanzamos a las fechas
      } else {
        console.error("[LOGIN] El JSON no contiene la propiedad 'token':", data);
        alert("El servidor no devolvió el parámetro 'token'.");
      }

    } catch (error) {
      console.error("[LOGIN] Error detectado:", error);
      alert("No se pudo iniciar sesión: " + error.message);
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