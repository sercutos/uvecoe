import React, { useState, useEffect, useRef } from "react";
import Toolbar from "../../components/Toolbar";

import { CssBaseline, Container, Paper, Typography, Switch, Box, Button, FormControlLabel, IconButton, CircularProgress, Alert, Snackbar } from "@mui/material";
import Grid from "@mui/material/GridLegacy";

// Importamos iconos de flechas 
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

import { useNavigate } from "react-router-dom";
import { fetchWithAuth } from "../../utils/api"; 
import {
  clearServerAuthRequired,
  getServerToken,
  isServerAuthRequired,
  markServerAuthRequired
} from "../../utils/auth";
import {
  pointsForToggle,
  reorderStudentsForStation
} from "../../utils/scoring.mjs";
import useChrono from "../../hooks/useChrono";

export default function EvaluationPage() {
  const navigate = useNavigate();
  
  // --- ESTADOS DE DATOS Y CARGA ---
  const [students, setStudents] = useState([]);
  const [questions, setQuestions] = useState([]); 
  const [answersByStudent, setAnswersByStudent] = useState({});
  const [stationName, setStationName] = useState("Cargando Estación..."); 
  const [stationId, setStationId] = useState(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [currentStudentIndex, setCurrentStudentIndex] = useState(0);
  const autoSyncRef = useRef(false);
  
  const currentStudent = students[currentStudentIndex] || null;
  const currentAnswers =
    (currentStudent && answersByStudent[currentStudent.id_estudiante]) || {};

  const shiftCodeVisual = sessionStorage.getItem("selected_shift_code") || "-";
  const roundCodeVisual = sessionStorage.getItem("selected_round_code") || "-";
  const chronoRoundId = Number(sessionStorage.getItem("selected_round_id")) || null;
  const chrono = useChrono({ roundId: chronoRoundId, stationId });
  const chronoAlert = ["finished", "aborted"].includes(chrono.status);
  const chronoWarn = ["paused", "stale", "offline", "connecting", "idle"].includes(
    chrono.status
  );

  // Sincronización silenciosa en segundo plano. No bloquea la evaluación:
  // si falla (sin WiFi), las respuestas quedan pendientes y se reintenta.
  const runAutoSync = async () => {
    if (autoSyncRef.current) return;
    if (!window.api?.sincronizarRespuestas) return;
    if (isServerAuthRequired()) return;

    const token = getServerToken();
    if (!token) {
      markServerAuthRequired();
      window.dispatchEvent(new Event("uvecoe:pending-changed"));
      return;
    }

    autoSyncRef.current = true;

    try {
      const result = await window.api.sincronizarRespuestas(token);

      if (result?.success) {
        clearServerAuthRequired();
        window.dispatchEvent(new Event("uvecoe:pending-changed"));
        window.dispatchEvent(new Event("uvecoe:sync-ok"));
      } else if (result?.code === "unauthorized" || result?.status === 401) {
        markServerAuthRequired();
        window.dispatchEvent(new Event("uvecoe:pending-changed"));
      } else if (result?.error) {
        console.warn("[AUTO-SYNC]", result.error);
        window.dispatchEvent(
          new CustomEvent("uvecoe:sync-error", { detail: result.error })
        );
      }
    } catch (syncError) {
      console.warn("[AUTO-SYNC] No se pudo sincronizar:", syncError);
      window.dispatchEvent(
        new CustomEvent("uvecoe:sync-error", {
          detail: syncError.message || "No se pudo sincronizar."
        })
      );
    } finally {
      autoSyncRef.current = false;
    }
  };

  // Intento al entrar y cada 5 minutos mientras la evaluación esté abierta.
  useEffect(() => {
    runAutoSync();
    const interval = setInterval(runAutoSync, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // --- LOGICA DE PETICIONES CON ALUMNOS Y PREGUNTAS DINÁMICAS ---
  useEffect(() => {
    const cargarTodoElFlujo = async () => {
      try {
        setLoading(true);
        setError(null);

        const shiftId = sessionStorage.getItem("selected_shift_id");
        const roundId = sessionStorage.getItem("selected_round_id");
        let plannerId = null;

        if (!shiftId || !roundId) {
          // Si se entra directamente en /evaluation (p. ej. desde el icono
          // "Evaluación Activa" del Toolbar), llevamos al primer paso que falte
          // en lugar de mostrar un error.
          if (!sessionStorage.getItem("selected_date_string")) {
            navigate("/", { replace: true });
          } else if (!roundId) {
            navigate("/rounds", { replace: true });
          } else {
            navigate("/turns", { replace: true });
          }

          setLoading(false);
          return;
        }

        // ==========================================
        // PASO 0: CONFIGURACIÓN LOCAL DE SQLITE
        // ==========================================
        const configLocal = await window.api.obtenerConfiguracion();
        const ecoeId = configLocal?.ecoe_id;
        const stationIdConfigurado = configLocal?.station_id;
        const stationOrderConfigurado = configLocal?.station_order;
        const blockIdConfigurado = configLocal?.block_id;

        if (!ecoeId || !stationIdConfigurado) {
          throw new Error("El equipo no cuenta con una configuración local de estación.");
        }

        setStationId(Number(stationIdConfigurado));

        let targetStation = null;
        let rawStudents = [];
        let rawQuestions = [];
        let studentsFromApi = false;
        let questionsFromApi = false;

        // ==========================================
        // 1. MODO ONLINE (si hay red)
        // ==========================================
        try {
          console.log(`[EVALUATION] Modo Online: estación ${stationIdConfigurado}...`);

          const stationsData = await fetchWithAuth(`/stations?ecoe_id=${ecoeId}`);
          const stationList = stationsData?.items || (Array.isArray(stationsData) ? stationsData : []);
          targetStation =
            stationList.find(
              (s) => Number(s.id) === Number(stationIdConfigurado)
            ) || null;

          const plannerData = await fetchWithAuth(
            `/planners?shift_id=${shiftId}&round_id=${roundId}`
          );
          plannerId =
            plannerData?.id ||
            (plannerData?.items && plannerData.items[0]?.id) ||
            plannerData[0]?.id ||
            null;

          if (plannerId) {
            const studentsData = await fetchWithAuth(
              `/students?planner_id=${plannerId}&per_page=200`
            );
            rawStudents = studentsData.items || studentsData || [];
            studentsFromApi = rawStudents.length > 0;
          }

          const blocksData = await fetchWithAuth(
            `/blocks?station_id=${stationIdConfigurado}`
          );
          const block =
            blocksData?.items?.[0] ||
            (Array.isArray(blocksData) ? blocksData[0] : null);

          if (block?.id) {
            const questionsData = await fetchWithAuth(
              `/questions?station_id=${stationIdConfigurado}&block_id=${block.id}&per_page=200`
            );
            rawQuestions = Array.isArray(questionsData)
              ? questionsData
              : questionsData.items || [];
            questionsFromApi = rawQuestions.length > 0;
          }
        } catch (onlineError) {
          console.warn(
            "[EVALUATION] Sin conexión o error online. Se completará desde SQLite...",
            onlineError.message
          );
        }

        // ==========================================
        // 2. COMPLETAR DESDE SQLITE (offline o datos parciales)
        // ==========================================
        if (!targetStation) {
          targetStation = {
            id: stationIdConfigurado,
            name:
              configLocal?.station_name ||
              `Estación Local #${stationIdConfigurado}`,
            order: stationOrderConfigurado ?? null,
            id_parent_station: null
          };
        }

        if (!plannerId) {
          const plannerLocal = await window.api.obtenerPlanner(
            Number(shiftId),
            Number(roundId)
          );
          plannerId = plannerLocal?.id ?? null;
        }

        // Último recurso: el planner que guardó SelectTurnPage.
        if (!plannerId) {
          plannerId = sessionStorage.getItem("selected_planner_id") || null;
        }

        if (!plannerId) {
          throw new Error(
            "No se encontró el planner para el turno y la ronda seleccionados. Vuelva a descargar la planificación."
          );
        }

        sessionStorage.setItem("selected_planner_id", String(plannerId));

        if (!rawStudents || rawStudents.length === 0) {
          rawStudents = await window.api.obtenerEstudiantesPlanner(
            Number(plannerId)
          );
        }

        if (!rawQuestions || rawQuestions.length === 0) {
          rawQuestions = await window.api.obtenerPreguntasLocales({
            stationId: Number(stationIdConfigurado),
            blockId: blockIdConfigurado ?? null
          });
        }

        // Si alumnos o preguntas vienen de la API, asegurarlos en SQLite antes
        // de permitir la evaluación. Así las FKs de resultados no fallan.
        if (studentsFromApi || questionsFromApi) {
          if (!window.api?.asegurarReferencias) {
            throw new Error(
              "No se pudo asegurar la referencia local de alumnos/preguntas (preload desactualizado)."
            );
          }

          await window.api.asegurarReferencias({
            students: studentsFromApi ? rawStudents : [],
            questions: questionsFromApi ? rawQuestions : [],
            stationId: Number(stationIdConfigurado),
            id_block: blockIdConfigurado ?? null
          });
        }

        // Validar el orden de la estación: sin él no se puede rotar.
        const stationOrder = Number(targetStation?.order);

        if (!Number.isFinite(stationOrder) || stationOrder < 1) {
          throw new Error(
            "Falta el orden de la estación para calcular la rotación. Reconfigure el portátil con conexión."
          );
        }

        setStationName(
          targetStation?.name || `Estación ${stationIdConfigurado}`
        );

        // Procesar Alumnos de forma uniforme
        if (!Array.isArray(rawStudents) || rawStudents.length === 0) {
          throw new Error(
            "No hay alumnos asignados al planner de este turno. Revise la planificación."
          );
        }

        if (rawStudents.length !== 12) {
          console.warn(
            `[EVALUATION] El planner ${plannerId} tiene ${rawStudents.length} alumnos; se esperaban 12.`
          );
        }

        const mappedStudents = rawStudents.map((student, idx) => {
          const ordenReal =
            student.planner_order !== undefined &&
            student.planner_order !== null
              ? Number(student.planner_order)
              : idx + 1;

          return {
            id_estudiante: student.id || student.id_estudiante,
            num: ordenReal,
            dni: student.dni || "",
            name:
              `${student.surnames || ""}, ${student.name || ""}`.trim().toUpperCase() ||
              student.name,
            turno: shiftCodeVisual,
            rueda: roundCodeVisual
          };
        });

        mappedStudents.sort((a, b) => a.num - b.num);
        const reorderedStudents = reorderStudentsForStation(
          mappedStudents,
          stationOrder
        );

        // Procesar Preguntas de forma uniforme
        if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
          throw new Error(
            "La estación de examen no contiene preguntas evaluables disponibles."
          );
        }

        rawQuestions.sort((a, b) => (a.order || 0) - (b.order || 0));

        const mappedQuestions = rawQuestions.map((q) => {
          return {
            id_pregunta_db: q.id || q.id_pregunta_db,
            id: q.question_schema?.reference || q.id_visual || `Q-${q.id}`,
            text:
              q.question_schema?.description ||
              q.texto_pregunta ||
              "Pregunta sin descripción",
            area: q.area?.name || q.area_nombre || "General",
            type: q.question_schema?.type || "checkbox",
            options: Array.isArray(q.question_schema?.options)
              ? q.question_schema.options
              : []
          };
        });

        setStudents(reorderedStudents);
        setQuestions(mappedQuestions);

      } catch (err) {
        console.error("[ERROR EVALUACIÓN GLOBAL]:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    cargarTodoElFlujo();
  }, [shiftCodeVisual, roundCodeVisual]);


  // --- Recuperar las respuestas del alumno de SQLite al cambiar de alumno o iniciar la pantalla
  useEffect(() => {
    if (!currentStudent || questions.length === 0) return;

    const studentId = currentStudent.id_estudiante;
    let active = true;

    const cargarRespuestasGuardadas = async () => {
      try {
        const configLocal = await window.api.obtenerConfiguracion();
        const id_station = configLocal?.station_id || 1;

        // 1. Pedimos a SQLite las respuestas que ya existan para este alumno en esta estación
        const respuestasGuardadas = await window.api.obtenerRespuestasAlumno({
          id_student: studentId,
          id_station: Number(id_station)
        });

        if (!active) return;

        // 2. Guardamos las respuestas bajo el id del alumno. Así una lectura
        // tardía del alumno anterior nunca cae en el alumno siguiente.
        const guardadas = {};
        for (const respuesta of respuestasGuardadas) {
          guardadas[respuesta.id_question] = Number(respuesta.points) > 0;
        }

        setAnswersByStudent((prev) => ({
          ...prev,
          [studentId]: {
            ...guardadas,
            // Si el evaluador ya tocó un switch mientras se leía, mandan sus datos.
            ...(prev[studentId] || {})
          }
        }));
      } catch (err) {
        console.error("Error al recuperar el progreso del alumno de SQLite:", err);
        if (!active) return;
        setAnswersByStudent((prev) => ({
          ...prev,
          [studentId]: prev[studentId] || {}
        }));
      }
    };

    cargarRespuestasGuardadas();

    return () => {
      active = false;
    };
  }, [currentStudent, questions]); // 🚀 Se dispara al cambiar de alumno o cargar preguntas
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
  }, [currentStudentIndex, students, answersByStudent, questions]);
  
    // ==========================================
  // 🚀 GUARDADO INMEDIATO POR CADA SWITCH (ULTRA SEGURO)
  // ==========================================
  const handleToggle = async (q) => {
    if (!currentStudent) return;

    const studentId = currentStudent.id_estudiante;
    const questionId = q.id_pregunta_db;
    const previousValue = Boolean(
      answersByStudent[studentId]?.[questionId]
    );
    const nuevoValorSwitch = !previousValue;

    // Actualizamos solo la respuesta de este alumno y esta pregunta.
    setAnswersByStudent((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || {}),
        [questionId]: nuevoValorSwitch
      }
    }));
    setSaveError(null);

    const configLocal = await window.api.obtenerConfiguracion();
    const id_station = configLocal?.station_id || 1;

    // Puntos reales publicados por el servidor en la rúbrica.
    const selectedOption = q.options?.[0] || null;
    const points = pointsForToggle(q, nuevoValorSwitch);

    // Esquema idéntico al que espera la API.
    const schema = {
      type: q.type || "checkbox",
      selected: nuevoValorSwitch
        ? [{ id_option: selectedOption?.id_option ?? 1 }]
        : []
    };

    const loteFilaUnica = [{
      id_student: studentId,
      id_question: questionId,
      id_station: Number(id_station),
      points,
      answer_schema: JSON.stringify(schema),
      sincronizado: false
    }];

    const revertir = () => {
      setAnswersByStudent((prev) => ({
        ...prev,
        [studentId]: {
          ...(prev[studentId] || {}),
          [questionId]: previousValue
        }
      }));
    };

    if (!window.api?.guardarResultadoLocal) {
      revertir();
      setSaveError(
        "No se pudo guardar la respuesta: falta el puente de Electron."
      );
      return;
    }

    try {
      await window.api.guardarResultadoLocal(loteFilaUnica);
      setSaveError(null);
      window.dispatchEvent(new Event("uvecoe:pending-changed"));
      console.log(
        `⚡ [AUTO-GUARDADO] Pregunta ${q.id} guardada como: ${nuevoValorSwitch ? "SÍ" : "NO"}`
      );
    } catch (errDb) {
      // Si SQLite rechaza la escritura, devolvemos el switch a su estado
      // anterior para que el evaluador no vea una respuesta falsamente guardada.
      revertir();
      setSaveError(
        `No se pudo guardar la respuesta de "${q.id}". ` +
          "Revisa la base de datos local y vuelve a intentarlo."
      );
      console.error("❌ Fallo en el auto-guardado inmediato:", errDb);
    }
  };
  
  // ==========================================
  // LÓGICA DE NAVEGACIÓN (AVANZA)
  // ==========================================
  const handleProcessEvaluation = () => {
    if (!currentStudent) return;

    const isLastStudent = currentStudentIndex === students.length - 1;

    if (!isLastStudent) {
      // Avanzamos de índice. El useEffect que pusimos en el paso anterior
      // se encargará de leer automáticamente de SQLite lo que tenga el siguiente alumno.
      setCurrentStudentIndex(currentStudentIndex + 1);

      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      runAutoSync();
      navigate("/turns"); // Fin del examen
      return;
    }

    // Al terminar un alumno, intentamos enviar lo pendiente sin bloquear.
    runAutoSync();
  };

  const handlePrevStudent = () => {
    if (currentStudentIndex > 0) {
      setCurrentStudentIndex(currentStudentIndex - 1);
    }
  };

  // --- PANTALLAS DE CARGA Y ERROR ---
  if (loading) {
    return (
      <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="80vh" gap={2}>
        <CircularProgress size={50} style={{ color: "#2b8ea7" }} />
        <Typography variant="body1" color="textSecondary">Cargando rúbricas y cuadrando rotación de estudiantes...</Typography>
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
      <Snackbar
        open={Boolean(chrono.event)}
        autoHideDuration={8000}
        onClose={chrono.clearEvent}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          severity="info"
          onClose={chrono.clearEvent}
          sx={{ width: "100%" }}
        >
          {chrono.event?.message}
        </Alert>
      </Snackbar>
      <Container maxWidth="lg" sx={{ mt: 10 }}>
        {saveError && (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
            onClose={() => setSaveError(null)}
          >
            {saveError}
          </Alert>
        )}

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
                  backgroundColor: chronoAlert
                    ? "#ffebee"
                    : chronoWarn
                      ? "#fff3e0"
                      : "#d2e4ec",
                  color: chronoAlert ? "#c62828" : chronoWarn ? "#e65100" : "#006687",
                  p: "2px 10px",
                  borderRadius: "4px",
                  transition: "all 0.3s ease",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  minWidth: "92px"
                }}
              >
                <Typography
                  component="span"
                  sx={{
                    fontWeight: "bold",
                    fontFamily: "monospace",
                    fontSize: "1.1rem",
                    lineHeight: 1
                  }}
                >
                  {chrono.formatted}
                </Typography>
                <Typography
                  component="span"
                  sx={{
                    fontSize: "0.62rem",
                    lineHeight: 1.1,
                    mt: 0.25,
                    maxWidth: "170px",
                    textAlign: "center",
                    overflow: "hidden",
                    textOverflow: "ellipsis"
                  }}
                >
                  {chrono.label}
                </Typography>
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
                      <Switch
                        checked={Boolean(currentAnswers[question.id_pregunta_db])}
                        onChange={() => handleToggle(question)}
                        color="primary"
                      />
                    }
                    label={currentAnswers[question.id_pregunta_db] ? "Sí" : "No"}
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