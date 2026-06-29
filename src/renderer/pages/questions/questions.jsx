
import React, { useState } from "react";
import Toolbar from "../../components/Toolbar";

import { styled } from '@mui/material/styles';
import { CssBaseline, Container, Grid, Paper, Typography, Switch, Box, Button, FormGroup, FormControlLabel, } from "@mui/material";


export default function QuestionPage() {
  const questions = [
    "¿Se identifica y se muestra atento y cordial con el paciente?",
    "¿Explica el procedimiento antes de realizarlo?",
    "¿Mantiene contacto visual y escucha activamente?",
    "¿Respeta la privacidad del paciente?",
    "¿Utiliza lenguaje claro y comprensible?",
    "¿Responde a las dudas del paciente con amabilidad?"
  ];

  // Estado para manejar los switches
  const [answers, setAnswers] = useState(
    questions.map(() => true) // todas activadas por defecto
  );

  const handleToggle = (index) => {
    const newAnswers = [...answers];
    newAnswers[index] = !newAnswers[index];
    setAnswers(newAnswers);
  };

  const handleSave = () => {
    console.log("Respuestas guardadas:", answers);
    alert("Respuestas guardadas correctamente");
  };

  return (
    <React.Fragment>
      <CssBaseline />
      <Toolbar />
      <Container maxWidth="md" sx={{ mt: 10 }}>
        <Paper elevation={3} sx={{ p: 3 }}>
          <Typography variant="h5" gutterBottom>
            Evaluación del Paciente
          </Typography>
          <Grid container spacing={2}>
            {questions.map((question, index) => (
              <Grid item xs={12} key={index}>
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    p: 2,
                    borderBottom: index !== questions.length - 1 ? "1px solid #ddd" : "none"
                  }}
                >
                  <Typography variant="body1">
                    {`Pregunta ${index + 1}: ${question}`}
                  </Typography>
                  <Switch
                    checked={answers[index]}
                    onChange={() => handleToggle(index)}
                    color="primary"
                  />
                </Box>
              </Grid>
            ))}
          </Grid>
          <Box sx={{ textAlign: "center", mt: 3 }}>
            <Button variant="contained" color="primary" onClick={handleSave}>
              Guardar respuestas
            </Button>
          </Box>
        </Paper>
      </Container>
    </React.Fragment>
  );
}

