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

        // Inicializamos el estado de los switches (todas en true por defecto) asociadas a su ID
        const initialAnswers = {};
        data.forEach(q => {
          initialAnswers[q.id] = true;
        });
        setAnswers(initialAnswers);

      } catch (error) {
        console.error("Error al cargar preguntas de la DB:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchPreguntas();
  }, [currentEstacion]); // Se vuelve a ejecutar automáticamente si cambias de estación

  // Alternar el switch usando el ID de la pregunta
  const handleToggle = (questionId) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: !prev[questionId]
    }));
  };

  const handleSave = () => {
    // 🧠 Formateamos la salida para el formato JSON que espera tu backend {"selected": 1} o similar
    const resultadoJSON = questions.map(q => ({
      pregunta_id: q.id,
      respuesta: {
        selected: answers[q.id] ? 1 : 0
      }
    }));

    console.log("Estructura lista para guardar en SQLite o mandar a API:", resultadoJSON);
    alert("Respuestas capturadas con éxito en memoria local.");
  };

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
            <Grid container spacing={2}>
              {questions.map((q, index) => (
                <Grid item xs={12} key={q.id}>
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      p: 2,
                      borderBottom: index !== questions.length - 1 ? "1px solid #ddd" : "none"
                    }}
                  >
                    <Box sx={{ pr: 2 }}>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {q.question_schema.reference || `Ref: PREG-${q.id}`}
                      </Typography>
                      <Typography variant="body1">
                        {q.question_schema.description}
                      </Typography>
                    </Box>
                    <Switch
                      checked={!!answers[q.id]} // Forzamos booleano seguro
                      onChange={() => handleToggle(q.id)}
                      color="primary"
                    />
                  </Box>
                </Grid>
              ))}
            </Grid>
          )}

          <Box sx={{ textAlign: "center", mt: 3 }}>
            <Button 
              variant="contained" 
              onClick={handleSave}
              disabled={questions.length === 0}
              sx={{ bgcolor: '#006687', '&:hover': { bgcolor: '#004c66' } }}
            >
              Guardar respuestas
            </Button>
          </Box>
        </Paper>
      </Container>
    </React.Fragment>
  );
}