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
  const [questions, setQuestions] = useState([]); 
  const [answers, setAnswers] = useState([]);     
  const [stationName, setStationName] = useState("Cargando Estación..."); 
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentStudentIndex, setCurrentStudentIndex] = useState(0);
  
  const currentStudent = students[currentStudentIndex] || null;

  const shiftCodeVisual = sessionStorage.getItem("selected_shift_code") || "-";
  const roundCodeVisual = sessionStorage.getItem("selected_round_code") || "-";

  // --- LOGICA DE PETICIONES CON ALUMNOS Y PREGUNTAS DINÁMICAS ---
  useEffect(() => {
    const cargarTodoElFlujo = async () => {
      try {
        setLoading(true);
        setError(null);

        const shiftId = sessionStorage.getItem("selected_shift_id");
        const roundId = sessionStorage.getItem("selected_round_id");

        if (!shiftId || !roundId) {
          throw new Error("No se ha detectado una selección válida de Turno o Ronda.");
        }

        // ==========================================
        // PASO 0: OBTENER CONFIGURACIÓN LOCAL DE SQLITE (ECOE_ID Y STATION_ID)
        // ==========================================
        const configLocal = await window.api.obtenerConfiguracion();
        const ecoeId = configLocal?.ecoe_id;
        const stationIdConfigurado = configLocal?.station_id;

        if (!ecoeId || !stationIdConfigurado) {
          throw new Error("El equipo no cuenta con una configuración local de estación.");
        }

        let targetStation = null;
        let rawStudents = [];
        let rawQuestions = [];

        try {
          // ==========================================
          // MODO ONLINE: Intentar consumir de FastAPI
          // ==========================================
          console.log(`[EVALUATION] Modo Online: Buscando estación ID ${stationIdConfigurado}...`);
          const stationsData = await fetchWithAuth(`http://localhost:8000/backend/api/v1/stations?ecoe_id=${ecoeId}`);
          const stationList = stationsData?.items || (Array.isArray(stationsData) ? stationsData : []);
          targetStation = stationList.find(s => Number(s.id) === Number(stationIdConfigurado)) || stationList[0];

          // Cargar Planificación y Alumnos online
          const plannerData = await fetchWithAuth(`http://localhost:8000/backend/api/v1/planners?shift_id=${shiftId}&round_id=${roundId}`);
          const plannerId = plannerData?.id || (plannerData?.items && plannerData.items[0]?.id) || plannerData[0]?.id;

          if (plannerId) {
            const studentsData = await fetchWithAuth(`http://localhost:8000/backend/api/v1/students?planner_id=${plannerId}`);
            rawStudents = studentsData.items || studentsData || [];
          }

          // Cargar preguntas online
          const blocksData = await fetchWithAuth(`http://localhost:8000/backend/api/v1/blocks?station_id=${stationIdConfigurado}`);
          const block = blocksData?.items?.[0] || (Array.isArray(blocksData) ? blocksData[0] : null);
          if (block) {
            const questionsData = await fetchWithAuth(`http://localhost:8000/backend/api/v1/questions?station_id=${stationIdConfigurado}&block_id=${block.id}`);
            rawQuestions = Array.isArray(questionsData) ? questionsData : (questionsData.items || []);
          }

        } catch (onlineError) {
          // ==========================================
          // MODO OFFLINE / CONTINGENCIA: Leer desde SQLite
          // ==========================================
          console.warn("[EVALUATION] Sin conexión. Conmutando a base de datos local SQLite...", onlineError.message);
          
          targetStation = { id: stationIdConfigurado, name: `Estación Local #${stationIdConfigurado}`, order: 1 };
          
          // Leer alumnos locales precargados
          if (window.api.obtenerAlumnosLocales) {
            rawStudents = await window.api.obtenerAlumnosLocales();
          } else {
            // Fallback si ejecutas en navegador puro
            rawStudents = [{ id: 111, name: "ALUMNO OFFLINE A", planner_order: 1 }, { id: 222, name: "ALUMNO OFFLINE B", planner_order: 2 }];
          }

          // Leer preguntas locales precargadas
          if (window.api.obtenerPreguntasLocales) {
            rawQuestions = await window.api.obtenerPreguntasLocales();
          } else {
            rawQuestions = [{ id: 99, question_schema: { reference: "Q-REF-01", description: "Pregunta Offline por defecto" }, area: { name: "General" } }];
          }
        }

        // Validar y parsear Estación
        setStationName(targetStation?.name || `Estación ${stationIdConfigurado}`);

        // Procesar Alumnos de forma uniforme
        if (rawStudents.length === 0) {
          throw new Error("No hay alumnos cargados para este entorno de evaluación.");
        }

        const mappedStudents = rawStudents.map((student, idx) => {
          const ordenReal = student.planner_order !== undefined && student.planner_order !== null
            ? Number(student.planner_order)
            : idx + 1;

          return {
            id_estudiante: student.id || student.id_estudiante,
            num: ordenReal,
            dni: student.dni || "", 
            name: `${student.surnames || ""}, ${student.name || ""}`.trim().toUpperCase() || student.name,
            turno: shiftCodeVisual, 
            rueda: roundCodeVisual
          };
        });

        mappedStudents.sort((a, b) => a.num - b.num);
        const reorderedStudents = reorderStudentsLegacy(mappedStudents, targetStation);

        // Procesar Preguntas de forma uniforme
        if (rawQuestions.length === 0) {
          throw new Error("La estación de examen no contiene preguntas evaluables disponibles.");
        }

        rawQuestions.sort((a, b) => (a.order || 0) - (b.order || 0));

        const mappedQuestions = rawQuestions.map((q) => ({
          id_pregunta_db: q.id || q.id_pregunta_db,
          id: q.question_schema?.reference || q.id_visual || `Q-${q.id}`,
          text: q.question_schema?.description || q.texto_pregunta || "Pregunta sin descripción",
          area: q.area?.name || q.area_nombre || "General"
        }));

        setStudents(reorderedStudents);
        setQuestions(mappedQuestions);
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

  // --- FUNCIÓN ADAPTADA DE REORDENAMIENTO LEGACY ---
  const reorderStudentsLegacy = (studentsList, station) => {
    const arrStudents = [];
    if (studentsList.length < 1) return studentsList;

    const stationOrder = station.order || 1;

    if (!station.parent_station && !station.parentStation) {
      arrStudents.push(studentsList[stationOrder - 1]);
    } else {
      arrStudents.push({});
    }

    let counter = 0;
    while (counter < studentsList.length) {
      const idx = studentsList.indexOf(arrStudents[arrStudents.length - 1]);
      
      const auxStudent = idx > 0
        ? studentsList[idx - 1]
        : (idx === 0)
          ? studentsList[studentsList.length - 1]
          : ((stationOrder - 1) - 1 >= 0)
            ? studentsList[(stationOrder - 1) - 1]
            : studentsList[studentsList.length - 1];
            
      arrStudents.push(auxStudent);
      counter++;
    }

    if (arrStudents[0] && arrStudents[0].dni) {
      const lastIndex = arrStudents.lastIndexOf(studentsList[stationOrder - 1]);
      delete arrStudents[lastIndex];
    } else {
      arrStudents.push(studentsList[stationOrder - 1]);
    }

    let cleanArrStudents = [...arrStudents];
    cleanArrStudents = cleanArrStudents.slice(1, cleanArrStudents.length - 1).filter(Boolean);

    if (arrStudents[0] || cleanArrStudents.length > 0) {
      cleanArrStudents.unshift(arrStudents[0]);
    } else { 
      cleanArrStudents.unshift(...studentsList);
      let n = cleanArrStudents.length;
      while (n < stationOrder) {
        cleanArrStudents.unshift({ num: n + 1 });
        n++;
      }
    }
    return cleanArrStudents;
  };

  // --- CONTROL DEL TECLADO ---
  useEffect(() => {
    const manejarTeclado = (event) => {
      if (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA") {
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault(); 
        handleProcessEvaluation();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        handlePrevStudent();
      }
    };

    window.addEventListener("keydown", manejarTeclado);
    return () => window.removeEventListener("keydown", manejarTeclado);
  }, [currentStudentIndex, students, answers, questions]);
  
  const handleToggle = (index) => {
    const newAnswers = [...answers];
    newAnswers[index] = !newAnswers[index];
    setAnswers(newAnswers);
  };

  // ==========================================
  // LOGICA PRINCIPAL DE GUARDADO EN SQLITE LOCAL
  // ==========================================
  const handleProcessEvaluation = async () => {
    if (!currentStudent) return;

    // Estructuramos el payload de evaluación
    const evaluacionParaGuardar = questions.map((q, idx) => ({
      question_id: q.id_pregunta_db,
      reference: q.id,
      checked: answers[idx] ? 1 : 0 // Normalizado a binario para SQLite
    }));

    console.log(`[GUARDANDO LOCALMENTE] Alumno ID ${currentStudent.id_estudiante}:`, evaluacionParaGuardar);
    
    // 🚀 ENVÍO DIRECTO A LA BASE DE DATOS LOCAL A TRAVÉS DE IPC
    if (window.api && window.api.guardarResultadoLocal) {
      try {
        await window.api.guardarResultadoLocal({
          alumno_id: currentStudent.id_estudiante,
          evaluacion: JSON.stringify(evaluacionParaGuardar),
          sincronizado: 0 // Flag para saber que hay que subirlo a producción luego
        });
      } catch (errDb) {
        console.error("[EVALUATION] Fallo al escribir resultado en SQLite:", errDb);
      }
    }

    const isLastStudent = currentStudentIndex === students.length - 1;

    if (!isLastStudent) {
      setCurrentStudentIndex(currentStudentIndex + 1);
      setAnswers(questions.map(() => true)); 
      
      setMinutes(7);
      setSeconds(0);

      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      navigate("/turns"); // Fin del bucle de alumnos
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
        <Typography variant="body1" color="textSecondary">Cargando rúbricas y cuadrando rotación de alumnos...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="80vh" gap={2}>
        <Typography variant="h6" color="error">Error en el Entorno de Evaluación</Typography>
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
                {stationName}
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
                {currentStudent ? currentStudent.name : "SIN ALUMNO"}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ position: "absolute", right: "16px", top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center", gap: 3, backgroundColor: "#fff", pl: 1, flexShrink: 0 }}>
            <Box display="flex" gap={2} textAlign="center" flexShrink={0}>
              <Box sx={{ minWidth: "55px" }}>
                <Typography variant="caption" color="textSecondary" display="block">Turno</Typography>
                <Typography variant="body2" sx={{ fontWeight: "bold" }}>{currentStudent?.turno}</Typography>
              </Box>
              <Box sx={{ minWidth: "35px" }}>
                <Typography variant="caption" color="textSecondary" display="block">Ronda</Typography>
                <Typography variant="body2" sx={{ fontWeight: "bold" }}>{currentStudent?.rueda}</Typography>
              </Box>
            </Box>

            <Box display="flex" alignItems="center" gap={1} flexShrink={0} sx={{ width: "135px", justifyContent: "flex-end" }}>
              <Button variant="outlined" color="error" onClick={handlePrevStudent} disabled={currentStudentIndex === 0} sx={{ minWidth: "42px", width: "42px", height: "38px", p: 0 }}>
                <ArrowBackIosNewIcon fontSize="small" />
              </Button>

              <Box sx={{ width: "35px", textAlign: "center", flexShrink: 0 }}>
                <Typography variant="caption" color="textSecondary" display="block">Num</Typography>
                <Typography variant="body1" sx={{ fontWeight: "bold" }}>{currentStudent?.num}</Typography>
              </Box>

              <Button variant="contained" onClick={handleProcessEvaluation} sx={{ backgroundColor: "#2b8ea7", '&:hover': { backgroundColor: "#1f697a" }, minWidth: "42px", width: "42px", height: "38px", p: 0 }}>
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
                  
                  <Typography variant="body1" sx={{ flex: 1, pr: 2 }}>
                    {`${index + 1}: ${question.text}`}
                  </Typography>

                  <Typography variant="caption" sx={{ mr: 2, color: "#2b8ea7", fontWeight: "bold" }}>
                    {question.area}
                  </Typography>

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