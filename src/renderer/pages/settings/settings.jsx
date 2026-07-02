import Toolbar from "../../components/Toolbar";
import { useNavigate } from "react-router-dom";

import {
  Box,
  Grid,
  Typography,
  Card,
  CardContent,
  Button,
  Switch,
  FormControlLabel,
  Alert
} from "@mui/material";

export default function Settings() {
  const navigate = useNavigate();

  return (
    <>
      <Toolbar />

      <Box sx={{ p: 4, marginTop: "60px" }}>
        <Typography variant="h4" gutterBottom>
          ⚙️ Settings
        </Typography>

        <Alert severity="info" sx={{ mb: 3 }}>
          Sistema offline activo - SQLite habilitado
        </Alert>

        <Grid container spacing={3}>
          {/* 🔄 Sincronizar */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6">🔄 Sincronizar datos</Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Descarga datos del servidor (ECOE, estaciones, alumnos, preguntas).
                </Typography>

                <Button variant="contained" sx={{ mt: 2 }}>
                  Sincronizar
                </Button>
              </CardContent>
            </Card>
          </Grid>

          {/* 🧹 Reset DB */}
          <Grid item xs={12} md={6}>
            <Card sx={{ border: "1px solid #ffcccc" }}>
              <CardContent>
                <Typography variant="h6">🧹 Reset base de datos</Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Borra todos los datos locales (irreversible).
                </Typography>

                <Button variant="outlined" color="error" sx={{ mt: 2 }}>
                  Reset DB
                </Button>
              </CardContent>
            </Card>
          </Grid>

          {/* 📊 Estado */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6">📊 Estado del sistema</Typography>

                <Box sx={{ mt: 2 }}>
                  <Typography>SQLite: 🟢 Activo</Typography>
                  <Typography>Servidor: 🟢 Conectado</Typography>
                  <Typography>Última sync: Nunca</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* 🧪 Debug */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6">🧪 Modo debug</Typography>

                <FormControlLabel
                  control={<Switch />}
                  label="Activar logs"
                  sx={{ mt: 1 }}
                />
              </CardContent>
            </Card>
          </Grid>

          {/* 📁 Export */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6">📁 Exportar datos</Typography>

                <Typography variant="body2" sx={{ mt: 1 }}>
                  Exporta alumnos y evaluaciones en JSON.
                </Typography>

                <Button variant="contained" color="success" sx={{ mt: 2 }}>
                  Exportar
                </Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </>
  );
}