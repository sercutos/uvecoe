
import React, { useState } from "react";
import Toolbar from "../../components/Toolbar";

import { styled } from '@mui/material/styles';
import { CssBaseline, Container, Grid, Paper, Typography, Switch, Box, Button, FormGroup, FormControlLabel, } from "@mui/material";


export default function EvaluationPage() {
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
            Preguntas:
          </Typography>
          <Grid container spacing={2} direction="column">
            {questions.map((question, index) => (
              <Grid item xs={12} sm={12} md={12} key={question}>
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    width: "100%",
                    p: 2,
                    borderBottom: index !== questions.length - 1 ? "1px solid #ddd" : "none"
                  }}
                >
                  <Typography variant="body1" sx={{ flex: 1 }}>
                    {`Pregunta ${index + 1}: ${question}`}
                  </Typography>
                  
                </Box>
              </Grid>
            ))}
          </Grid>
        </Paper>
      </Container>
    </React.Fragment>
  );
}

