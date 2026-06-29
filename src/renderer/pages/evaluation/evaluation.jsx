import React, { useState, useEffect } from "react";
import Toolbar from "../../components/Toolbar";

import { CssBaseline, Container, Grid, Paper, Typography, Switch, Box, Button, FormControlLabel, IconButton, CircularProgress } from "@mui/material";

// Importamos iconos de flechas 
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

import { useNavigate } from "react-router-dom";
import { fetchWithAuth } from "../../utils/api"; 

export default function EvaluationPage() {
  const navigate = useNavigate();
  
  // --- ESTADOS DE DATOS Y CARGA ---
  const [students, setStudents] = useState([]);
  const [questions, setQuestions] = useState([]); // 🚀 ¡Ahora empieza vacío!
  const [answers, setAnswers] = useState([]);     // 🚀 Se generará dinámicamente
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentStudentIndex, setCurrentStudentIndex] = useState(0);
  
  const currentStudent = students[currentStudentIndex] || null;

  const shiftCodeVisual = sessionStorage.getItem("selected_shift_code") || "-";
  const roundCodeVisual = sessionStorage.getItem("selected_round_code") || "-";

  // ID de la estación temporalmente fijo (Hardcoded a 19 como me has pedido)
  const STATION_ID = 19;

  // --- LOGICA DE PETICIONES CON ALUMNOS Y PREGUNTAS DINÁMICAS ---
  useEffect(() => {
    const cargarTodoElFlujo = async () => {
      try {
        setLoading(true);
        setError(null);

        // 1. Rescatamos los IDs de sesión para los alumnos
        const shiftId = sessionStorage.getItem("selected_shift_id");
        const roundId = sessionStorage.getItem("selected_round_id");

        if (!shiftId || !roundId) {
          throw new Error("No se ha detectado una selección válida de Turno o Ronda.");
        }

        // ==========================================
        // PASO A: CARGAR PLANNER Y ESTUDIANTES
        // ==========================================
        const plannerData = await fetchWithAuth(`http://localhost:8000/backend/api/v1/planners?shift_id=${shiftId}&round_id=${roundId}`);
        const plannerId = plannerData?.id || (plannerData?.items && plannerData.items[0]?.id) || plannerData[0]?.id;

        if (!plannerId) {
          throw new Error("No existe una planificación asociada a este turno y ronda.");
        }

        const studentsData = await fetchWithAuth(`http://localhost:8000/backend/api/v1/students?planner_id=${plannerId}`);
        const rawStudents = studentsData.items || studentsData || [];

        if (rawStudents.length === 0) {
          throw new Error("No hay alumnos asignados a este turno de evaluación.");
        }

        const mappedStudents = rawStudents.map((student, idx) => ({
          id_estudiante: student.id,
          num: student.planner_order || idx + 1,
          name: `${student.surnames || ""}, ${student.name || ""}`.trim().toUpperCase(),
          turno: shiftCodeVisual, 
          rueda: roundCodeVisual
        }));
        mappedStudents.sort((a, b) => a.num - b.num);

        // ==========================================
        // PASO B: CARGAR BLOQUES DE LA ESTACIÓN
        // ==========================================
        console.log(`[PREGUNTAS] Descargando bloques para la estación: ${STATION_ID}`);
        const blocksData = await fetchWithAuth(`http://localhost:8000/backend/api/v1/blocks?station_id=${STATION_ID}`);
        
        const block = blocksData?.items?.[0] || (Array.isArray(blocksData) ? blocksData[0] : null);
        if (!block) {
          throw new Error(`La estación ${STATION_ID} no tiene ningún bloque de preguntas configurado.`);
        }

        // ==========================================
        // PASO C: CARGAR PREGUNTAS DEL BLOQUE DETECTADO
        // ==========================================
        console.log(`[PREGUNTAS] Descargando preguntas del Bloque ID: ${block.id}`);
        const questionsData = await fetchWithAuth(`http://localhost:8000/backend/api/v1/questions?station_id=${STATION_ID}&block_id=${block.id}`);
        
        const rawQuestions = Array.isArray(questionsData) ? questionsData : (questionsData.items || []);

        if (rawQuestions.length === 0) {
          throw new Error("Este bloque no contiene preguntas evaluables.");
        }

        // Ordenamos las preguntas según su propiedad 'order' del backend
        rawQuestions.sort((a, b) => (a.order || 0) - (b.order || 0));

        // Mapeamos el esquema interno de tu API (question_schema) a lo que necesita la vista
        const mappedQuestions = rawQuestions.map((q) => ({
          id_pregunta_db: q.id,
          id: q.question_schema?.reference || `Q-${q.id}`,
          text: q.question_schema?.description || "Pregunta sin descripción",
          area: q.area?.name || "General"
        }));

        // 5. Seteamos los estados de manera síncrona
        setStudents(mappedStudents);
        setQuestions(mappedQuestions);
        
        // Inicializamos las respuestas a 'true' (Sí) para tantas preguntas como hayan venido
        setAnswers(mappedQuestions.map(() => true));

      } catch (err) {
        console.error("[ERROR EVALUACIÓN GLOBAL]:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    cargarTodoElFlujo();
  }, [shiftCodeVisual, roundCodeVisual]);

  // ==========================================
  // EFECTO 2: CONTROL DEL TECLADO (Monitorea cambios en caliente)
  // ==========================================
  useEffect(() => {
    const manejarTeclado = (event) => {
      // Evitamos disparar si están redactando en alguna caja de texto
      if (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA") {
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault(); 
        console.log("[TECLADO] Flecha Derecha -> Siguiente");
        handleProcessEvaluation();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        console.log("[TECLADO] Flecha Izquierda -> Anterior");
        handlePrevStudent();
      }
    };

    window.addEventListener("keydown", manejarTeclado);

    // Limpiamos el evento anterior cada vez que cambien los datos de evaluación
    return () => {
      window.removeEventListener("keydown", manejarTeclado);
    };
    // Al teclado sí le interesan estas dependencias para no quedarse con estados antiguos
  }, [currentStudentIndex, students, answers, questions]);
  
  // --- MANEJADORES DE NAVEGACIÓN ---
  const handleToggle = (index) => {
    const newAnswers = [...answers];
    newAnswers[index] = !newAnswers[index];
    setAnswers(newAnswers);
  };

  const handleProcessEvaluation = () => {
    if (!currentStudent) return;

    // Estructura ideal de payload combinando el ID de la pregunta y el estado del switch
    const evaluacionParaGuardar = questions.map((q, idx) => ({
      question_id: q.id_pregunta_db,
      reference: q.id,
      checked: answers[idx]
    }));

    console.log(`[GUARDANDO] Alumno ID ${currentStudent.id_estudiante} (${currentStudent.name}):`, evaluacionParaGuardar);
    
    const isLastStudent = currentStudentIndex === students.length - 1;

    if (!isLastStudent) {
      setCurrentStudentIndex(currentStudentIndex + 1);
      // Volvemos a inicializar las respuestas a 'true' para el siguiente alumno
      setAnswers(questions.map(() => true)); 
      
      setMinutes(7);
      setSeconds(0);

      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      navigate("/turns");
    }
  };

  const handlePrevStudent = () => {
    if (currentStudentIndex > 0) {
      setCurrentStudentIndex(currentStudentIndex - 1);
      setAnswers(questions.map(() => true));
    }
  };

  // --- CRONÓMETRO ---
  const [minutes, setMinutes] = useState(7);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      if (seconds > 0) {
        setSeconds(seconds - 1);
      } else if (seconds === 0) {
        if (minutes === 0) {
          setMinutes(7);
          setSeconds(0);
        } else {
          setMinutes(minutes - 1);
          setSeconds(59);
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [minutes, seconds]);

  // --- PANTALLAS DE CARGA Y ERROR ---
  if (loading) {
    return (
      <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="80vh" gap={2}>
        <CircularProgress size={50} style={{ color: "#2b8ea7" }} />
        <Typography variant="body1" color="textSecondary">Sincronizando alumnos, bloques y rúbrica dinámica...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="80vh" gap={2}>
        <Typography variant="h6" color="error">Error de Sincronización API</Typography>
        <Typography variant="body2" color="textSecondary" sx={{ maxWidth: '400px', textAlign: 'center' }}>{error}</Typography>
        <Button variant="contained" onClick={() => navigate("/turns")} sx={{ mt: 2, backgroundColor: "#2b8ea7" }}>
          Volver a Turnos
        </Button>
      </Box>
    );
  }

  return (
    <React.Fragment>
      <CssBaseline />
      <Toolbar />
      <Container maxWidth="lg" sx={{ mt: 10 }}>
        
        {/* TARJETA DEL ALUMNO ACTUAL */}
        <Paper elevation={1} sx={{ p: 2, mb: 3, backgroundColor: "#fff", position: "relative", minHeight: "72px", display: "flex", alignItems: "center" }}>
          <Box sx={{ pr: "320px", display: "flex", alignItems: "center", gap: 2, width: "100%", minWidth: 0 }}>
            <Box display="flex" alignItems="center" gap={1} flexShrink={0}>
              <IconButton color="primary" size="small" onClick={() => navigate("/turns")}>
                <ArrowBackIcon />
              </IconButton>
              <Typography variant="h6" sx={{ color: "#006687", fontWeight: "500", whiteSpace: "nowrap" }}>
                Estación 1
              </Typography>
              <Box 
                sx={{ 
                  backgroundColor: minutes === 0 ? "#ffebee" : "#d2e4ec", 
                  color: minutes === 0 ? "#c62828" : "#006687", 
                  p: "2px 10px", borderRadius: "4px", fontWeight: "bold",
                  fontFamily: "monospace", fontSize: "1.1rem", transition: "all 0.3s ease" 
                }}
              >
                {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
              </Box>
            </Box>

            <Box sx={{ width: "1px", height: "25px", backgroundColor: "#ddd", flexShrink: 0 }} />

            <Box sx={{ minWidth: 0, flexGrow: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: "bold", color: "#333", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {currentStudent.name}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ position: "absolute", right: "16px", top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center", gap: 3, backgroundColor: "#fff", pl: 1, flexShrink: 0 }}>
            <Box display="flex" gap={2} textAlign="center" flexShrink={0}>
              <Box sx={{ minWidth: "55px" }}>
                <Typography variant="caption" color="textSecondary" display="block">Turno</Typography>
                <Typography variant="body2" sx={{ fontWeight: "bold" }}>{currentStudent.turno}</Typography>
              </Box>
              <Box sx={{ minWidth: "35px" }}>
                <Typography variant="caption" color="textSecondary" display="block">Ronda</Typography>
                <Typography variant="body2" sx={{ fontWeight: "bold" }}>{currentStudent.rueda}</Typography>
              </Box>
            </Box>

            <Box display="flex" alignItems="center" gap={1} flexShrink={0} sx={{ width: "135px", justifyContent: "flex-end" }}>
              <Button variant="outlined" color="error" onClick={handlePrevStudent} disabled={currentStudentIndex === 0} sx={{ minWidth: "42px", width: "42px", height: "38px", p: 0 }}>
                <ArrowBackIosNewIcon fontSize="small" />
              </Button>

              <Box sx={{ width: "35px", textAlign: "center", flexShrink: 0 }}>
                <Typography variant="caption" color="textSecondary" display="block">Num</Typography>
                <Typography variant="body1" sx={{ fontWeight: "bold" }}>{currentStudent.num}</Typography>
              </Box>

              <Button variant="contained" onClick={handleProcessEvaluation} disabled={currentStudentIndex === students.length - 1} sx={{ backgroundColor: "#2b8ea7", '&:hover': { backgroundColor: "#1f697a" }, minWidth: "42px", width: "42px", height: "38px", p: 0 }}>
                <ArrowForwardIosIcon fontSize="small" />
              </Button>
            </Box>
          </Box>
        </Paper>

        {/* CONTENEDOR DE PREGUNTAS TOTALMENTE DINÁMICO */}
        <Paper elevation={3} sx={{ p: 3 }}>
          <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
            Preguntas de Evaluación:
          </Typography>
          <Grid container spacing={2} direction="column">
            {questions.map((question, index) => (
              <Grid item xs={12} key={question.id_pregunta_db}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", p: 2, borderBottom: index !== questions.length - 1 ? "1px solid #ddd" : "none" }}>
                  
                  {/* Texto Dinámico extraído de question_schema.description */}
                  <Typography variant="body1" sx={{ flex: 1, pr: 2 }}>
                    {`${index + 1}: ${question.text}`}
                  </Typography>

                  {/* Área Médica (ej: Anamnesis) como tag informativo opcional o el ID de referencia */}
                  <Typography variant="caption" sx={{ mr: 2, color: "#2b8ea7", fontWeight: "bold" }}>
                    {question.area}
                  </Typography>

                  {/* Código Dinámico extraído de question_schema.reference (E1-Q1, E1-Q2...) */}
                  <Typography variant="body2" sx={{ width: "80px", color: "text.secondary", fontWeight: "bold", textAlign: "center", backgroundColor: "#f5f5f5", borderRadius: "4px", p: 0.5, mr: 4 }}>
                    {question.id}
                  </Typography>
                  
                  <FormControlLabel
                    sx={{ minWidth: "80px", m: 0 }}
                    control={
                      <Switch checked={answers[index] || false} onChange={() => handleToggle(index)} color="primary" />
                    }
                    label={answers[index] ? "Sí" : "No"}
                  />
                </Box>
              </Grid>
            ))}
          </Grid>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 4 }}>
            <Button 
              variant="contained" 
              color={currentStudentIndex === students.length - 1 ? "success" : "primary"} 
              size="large" 
              onClick={handleProcessEvaluation}
              sx={{ fontWeight: "bold", px: 4 }}
            >
              {currentStudentIndex === students.length - 1 ? "Ronda Finalizada" : "Siguiente Alumno"}
            </Button>
          </Box>
        </Paper>

      </Container>
    </React.Fragment>
  );
}