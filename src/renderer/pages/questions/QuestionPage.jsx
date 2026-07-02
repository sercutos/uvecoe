import React, { useState, useEffect } from "react";
import Toolbar from "../../components/Toolbar";
import { CssBaseline, Container, Grid, Paper, Typography, Switch, Box, Button, CircularProgress } from "@mui/material";

export default function QuestionPage() {
  // 🚀 ESTADO: Guardamos las preguntas reales que vienen de SQLite
  const [questions, setQuestions] = useState([]);
  
  // 🚀 ESTADO: Guardamos las respuestas usando el ID de la pregunta como clave: { [id]: true }
  const [answers, setAnswers] = useState({});
  
  // ESTADO: Control de carga de la BD
  const [loading, setLoading] = useState(true);

  // 📋 Estación seleccionada actualmente (Sustituye este string por tu estado global/contexto si lo tienes)
  const [currentEstacion, setCurrentEstacion] = useState("Estación 1"); 

  // Cargar preguntas desde la base de datos al renderizar o al cambiar de estación
  useEffect(() => {
    async function fetchPreguntas() {
      try {
        setLoading(true);
        // Llamamos al canal IPC mandando la estación actual como filtro
        const data = await window.api.invoke('db:obtener-preguntas', currentEstacion);
        
        setQuestions(data);

        // Inicializamos el estado de los switches con los IDs reales
        const initialAnswers = {};
        data.forEach(q => {
          initialAnswers[q.id] = true; // Por defecto marcadas
        });
        setAnswers(initialAnswers);

      } catch (error) {
        console.error("Error al cargar preguntas de la DB:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchPreguntas();
  }, [currentEstacion]);

  // Cambiar el valor del switch de una pregunta específica
  const handleToggle = (questionId) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: !prev[questionId]
    }));
  };

  const handleSave = async () => {
    try {
      // 📋 El ID del alumno evaluado (Sustituye por el ID real del alumno que esté seleccionado en tu vista)
      const id_student = 12; 
      // 📋 El ID de la estación activa (Sustituye por tu estado real o config)
      const id_station = 5; 

      // Construimos el array de filas listas para meter a SQLite
      const respuestasParaGuardar = questions.map(q => {
        const isChecked = !!answers[q.id];

        // 🧠 Construimos exactamente el answer_schema que exige tu FastAPI
        const schema = {
          type: "checkbox",
          selected: isChecked ? [{ id_option: 1 }] : []
        };

        return {
          id_student: id_student,
          id_question: q.id,
          id_station: id_station,
          points: isChecked ? 1 : 0, 
          answer_schema: JSON.stringify(schema), 
          sincronizado: false
        };
      });

      console.log("Estructura lista para guardar en SQLite:", respuestasParaGuardar);

      // Enviamos el lote a guardar en la SQLite mediante IPC (Asegúrate de que coincida con el nombre de tu main.js)
      const response = await window.api.invoke("db:guardar-resultado", respuestasParaGuardar);
      
      if (response.success) {
        alert("🎉 Respuestas de la evaluación guardadas localmente con éxito.");
      }
    } catch (error) {
      console.error("Error al guardar resultados:", error);
      alert("❌ Error al guardar las respuestas localmente.");
    }
  }; // 👈 ¡Aquí estaba el lío de las llaves corregido!

  return (
    <React.Fragment>
      <CssBaseline />
      <Toolbar />
      <Container maxWidth="md" sx={{ mt: 10 }}>
        <Paper elevation={3} sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#006687' }}>
              Evaluación del Paciente 
            </Typography>
            <Typography variant="subtitle2" color="text.secondary">
              Estación activa: <strong>{currentEstacion}</strong>
            </Typography>
          </Box>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress sx={{ color: '#006687' }} />
            </Box>
          ) : questions.length === 0 ? (
            <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
              No hay preguntas configuradas para esta estación en la base de datos local.
            </Typography>
          ) : (
            <Grid container spacing={2} direction="column">
              {[...questions]
                .sort((a, b) => a.order - b.order)
                .map((q) => (
                  <Grid item xs={12} key={q.id}>
                    <Box
                      sx={{
                        display: "flex",
                        gap: 2,
                        alignItems: "center",
                        justifyContent: "space-between",
                        p: 2,
                        borderBottom: "1px solid #ddd"
                      }}
                    >
                      {/* REFERENCIA */}
                      <Box sx={{ minWidth: 120 }}>
                        <Typography variant="caption" color="text.secondary">
                          {q.question_schema?.reference || `Ref: PREG-${q.id}`}
                        </Typography>
                      </Box>

                      {/* DESCRIPCIÓN */}
                      <Box sx={{ flex: 1, px: 2 }}>
                        <Typography variant="body1">
                          {q.question_schema?.description || 'Sin descripción disponible'}
                        </Typography>
                      </Box>

                      {/* INTERRUPTOR (SWITCH) */}
                      <Box>
                        <Switch
                          checked={!!answers[q.id]}
                          onChange={() => handleToggle(q.id)}
                          color="primary"
                        />
                      </Box>
                    </Box>
                  </Grid>
                ))}
            </Grid>
          )}

          {questions.length > 0 && (
            <Box sx={{ textAlign: "center", mt: 3 }}>
              <Button 
                variant="contained" 
                onClick={handleSave}
                sx={{ bgcolor: '#006687', '&:hover': { bgcolor: '#004c66' } }}
              >
                Guardar respuestas
              </Button>
            </Box>
          )}
   
        </Paper>
      </Container>
    </React.Fragment>
  );
}