import React, { useEffect, useState } from "react";
import Toolbar from "../../components/Toolbar";
import {
  Alert,
  Box,
  CircularProgress,
  Container,
  CssBaseline,
  Paper,
  Typography
} from "@mui/material";
import Grid from "@mui/material/GridLegacy";

// Vista informativa: muestra la rúbrica de la estación, sin permitir responder.
export default function QuestionPage() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;

    const cargarPreguntas = async () => {
      try {
        const config = await window.api.obtenerConfiguracion();

        if (!config?.station_id) {
          throw new Error(
            "El terminal no está configurado con una estación."
          );
        }

        const data = await window.api.obtenerPreguntasLocales({
          stationId: Number(config.station_id),
          blockId: config.block_id ?? null
        });

        if (active) setQuestions(Array.isArray(data) ? data : []);
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    };

    cargarPreguntas();

    return () => {
      active = false;
    };
  }, []);

  const ordenadas = [...questions].sort(
    (a, b) => (a.order || 0) - (b.order || 0)
  );

  return (
    <React.Fragment>
      <CssBaseline />
      <Toolbar />
      <Container maxWidth="md" sx={{ mt: 10 }}>
        <Paper elevation={3} sx={{ p: 3 }}>
          <Typography
            variant="h5"
            sx={{ fontWeight: "bold", color: "#006687" }}
          >
            Preguntas de la estación
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 3 }}>
            Vista informativa. Aquí no se responde: las respuestas se registran
            en la pantalla de Evaluación.
          </Typography>

          {loading && (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress sx={{ color: "#006687" }} />
            </Box>
          )}

          {!loading && error && <Alert severity="error">{error}</Alert>}

          {!loading && !error && ordenadas.length === 0 && (
            <Typography
              variant="body1"
              color="text.secondary"
              sx={{ textAlign: "center", py: 4 }}
            >
              No hay preguntas configuradas para esta estación.
            </Typography>
          )}

          {!loading && !error && ordenadas.length > 0 && (
            <Grid container spacing={2} direction="column">
              {ordenadas.map((q, index) => (
                <Grid item xs={12} key={q.id}>
                  <Box
                    sx={{
                      p: 2,
                      borderBottom:
                        index !== ordenadas.length - 1
                          ? "1px solid #ddd"
                          : "none"
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 2,
                        alignItems: "baseline"
                      }}
                    >
                      <Typography variant="caption" color="text.secondary">
                        {q.question_schema?.reference || `PREG-${q.id}`}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ color: "#2b8ea7", fontWeight: "bold" }}
                      >
                        {q.area?.name || "General"}
                      </Typography>
                    </Box>

                    <Typography variant="body1" sx={{ mt: 0.5 }}>
                      {`${index + 1}. ${
                        q.question_schema?.description || "Sin descripción"
                      }`}
                    </Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          )}
        </Paper>
      </Container>
    </React.Fragment>
  );
}
