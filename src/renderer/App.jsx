import React, { useEffect, useState } from "react";
import { Box, CircularProgress, Typography } from "@mui/material";
import AdminConfig from "./pages/admin/AdminConfig"; // Asegúrate de la ruta de tu componente

export default function App({ children }) {
  const [isConfigured, setIsConfigured] = useState(null);

  useEffect(() => {
    async function checkConfiguration() {
      try {
        // Consultamos en SQLite si ya existe fila de configuración
        const config = await window.api.obtenerConfiguracion();
        setIsConfigured(!!config); // true si existe, false si es undefined/null
      } catch (error) {
        console.error("Error al verificar configuración local:", error);
        setIsConfigured(false);
      }
    }
    checkConfiguration();
  }, []);

  // Mientras lee la base de datos local, muestra una pantalla de carga sutil
  if (isConfigured === null) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", height: "100vh", gap: 2 }}>
        <CircularProgress />
        <Typography variant="body1">Verificando estado del terminal...</Typography>
      </Box>
    );
  }

  // Si NO está configurado, bloqueamos la app mostrando el Panel de Administración
  if (!isConfigured) {
    return <AdminConfig onConfigSuccess={() => setIsConfigured(true)} />;
  }

  // Si YA está configurado, renderiza de forma transparente las pantallas hijas (el flujo normal del examen)
  return <>{children}</>;
}