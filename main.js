const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const queries = require("./src/db/queries");
const settings = require("./src/db/settings");

const isDev = process.env.NODE_ENV === "development";

let mainWindow;
let splashWindow;
let db;
let syncInProgress = false;

function getDbPath() {
  if (app.isPackaged) {
    return path.join(app.getPath("userData"), "uvecoe.db");
  }

  return path.join(process.cwd(), "data", "uvecoe.db");
}

function createWindow() {
  splashWindow = new BrowserWindow({
    width: 400,
    height: 300,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
  });
  splashWindow.loadFile(path.join(__dirname, "assets/splash.html"));

  splashWindow.once("ready-to-show", () => {
    setTimeout(() => {
      splashWindow.close();
      createMainWindow(); // Abrimos la ventana principal directamente después del splash
    }, 1000);
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 700,
    show: false,
    icon: path.join(__dirname, '/assets/images/icono.png'),
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
      webSecurity: false,
    },
  });

  // Quita el menú nativo de la ventana superior
  mainWindow.setMenu(null);

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools(); // Abre las herramientas de desarrollador automáticamente en dev
  } else {
    mainWindow.loadFile(path.join(__dirname, "dist/index.html"));
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });
}

// 🚀 ARRANQUE DE LA APP + MIGRACIONES AUTOMÁTICAS DE SQLITE
app.whenReady().then(async () => {
  const dbPath = getDbPath();
  try {
    console.log("[MIGRACIONES] Comprobando actualizaciones de la base de datos local...");

    // 🧠 PARAMETRIZACIÓN OFFLINE:
    // Solo borramos la base de datos en desarrollo SI además le pasamos el flag explícito RESET_DB=true
    const forzarBorradoCompleto = process.env.RESET_DB === "true";

    if (isDev && fs.existsSync(dbPath) && forzarBorradoCompleto) {
      console.log("[DEV] Borrando DB...");
      fs.unlinkSync(dbPath);
    } else if (fs.existsSync(dbPath)) {
      console.log("📦 [OFFLINE] Base de datos física detectada. Manteniendo datos persistentes.");
    }
    
    db = require("./src/db/knex");
    console.log("[DB] Ejecutando migraciones...");
    await db.migrate.latest(); 
    
    console.log("[MIGRACIONES] Base de datos local al dia.");

    //const cols = await db.raw("PRAGMA table_info(questions)");
    //console.log("📦 ESTRUCTURA QUESTIONS:", cols);
  } catch (error) {
    console.error("[ERROR MIGRACIONES INTERNAS]:", error);
  }

  // Una vez revisada la DB, lanzamos el flujo visual (Splash -> Main)
  createWindow();
});

// ==========================================
// ESCUCHADORES IPC PARA REACT <-> SQLITE (QUERIES REALES)
// ==========================================
ipcMain.handle("db:obtenerConfiguracion", async () => {
  try {
    return await queries.obtenerConfiguracion();
  } catch (error) {
    console.error("Error en IPC obtenerConfiguracion:", error);
    throw error;
  }
});

ipcMain.handle("db:guardarConfiguracion", async (event, config) => {
  try {
    return await queries.guardarConfiguracion(config);
  } catch (error) {
    console.error("Error en IPC guardarConfiguracion:", error);
    throw error;
  }
});

ipcMain.handle("db:get-setting", async (event, key) => {
  try {
    return await settings.getSetting(key);
  } catch (error) {
    console.error("Error en IPC get-setting:", error);
    throw error;
  }
});

ipcMain.handle("db:set-setting", async (event, key, value) => {
  try {
    return await settings.setSetting(key, value);
  } catch (error) {
    console.error("Error en IPC set-setting:", error);
    throw error;
  }
});

ipcMain.handle("db:obtenerUsuarioLocal", async (event, email) => {
  try {
    return await queries.obtenerUsuarioPorEmail(email);
  } catch (error) {
    console.error("Error en IPC obtenerUsuarioLocal:", error);
    throw error;
  }
});

ipcMain.removeHandler('db:guardarUsuarioLocal');
ipcMain.handle('db:guardarUsuarioLocal', async (event, usuario) => {
  try {
    // Si el servidor no manda el ID, generamos uno basado en tiempo para evitar NULL.
    const idServerValido =
      usuario.usuario_id_server !== undefined &&
      usuario.usuario_id_server !== null
        ? usuario.usuario_id_server
        : usuario.id || Date.now();

    // Aceptamos token o token_temporal (Login manda "token").
    const tokenLocal =
      usuario.token_temporal ?? usuario.token ?? null;

    // Hash de contraseña para el login offline (lo calcula el renderer).
    const passwordHash =
      typeof usuario.password_hash === "string" &&
      usuario.password_hash.length > 0
        ? usuario.password_hash
        : null;

    const emailNormalizado = String(usuario.email || "").trim().toLowerCase();

    const usuarioExistente = await db("users")
      .whereRaw("LOWER(email) = ?", [emailNormalizado])
      .first();

    if (usuarioExistente) {
      const cambios = {
        role: usuario.role || "evaluador",
        usuario_id_server: idServerValido
      };

      // No borrar el token/hash existente si esta llamada no los trae.
      if (tokenLocal !== null) cambios.token_temporal = tokenLocal;
      if (passwordHash !== null) cambios.password_hash = passwordHash;

      await db("users").where({ id: usuarioExistente.id }).update(cambios);
      console.log(
        `🔄 [KNEX] Sincronizado perfil de usuario existente: ${emailNormalizado}`
      );
    } else {
      await db("users").insert({
        email: emailNormalizado,
        role: usuario.role || "evaluador",
        token_temporal: tokenLocal,
        password_hash: passwordHash,
        usuario_id_server: idServerValido
      });
      console.log(
        `💾 [KNEX] Guardado nuevo usuario en el portátil: ${emailNormalizado}`
      );
    }

    return { success: true };
  } catch (error) {
    console.error(
      "❌ Error guardando usuario local con validación NOT NULL:",
      error
    );
    throw error;
  }
});

ipcMain.removeHandler('db:guardarDatosIniciales');
ipcMain.handle('db:guardarDatosIniciales', async (event, payload) => {
  try {
    console.log(`[SQLITE] Procesando lote inicial (turnos, rondas, planners, alumnos, preguntas y usuarios)...`);
    await queries.guardarDatosIniciales(payload);
    console.log("✅ Lote inicial persistido con éxito en SQLite.");
    return { success: true };
  } catch (error) {
    console.error("❌ Error crítico en la transacción de Knex:", error);
    throw error;
  }
});

// --- CONSULTAS DE PLANIFICACIÓN PARA EL MODO OFFLINE ---
ipcMain.handle("db:obtener-shifts", async (event, ecoeId) => {
  try {
    return await queries.obtenerShifts(ecoeId);
  } catch (error) {
    console.error("Error en IPC obtener-shifts:", error);
    throw error;
  }
});

ipcMain.handle("db:obtener-rounds", async (event, ecoeId) => {
  try {
    return await queries.obtenerRounds(ecoeId);
  } catch (error) {
    console.error("Error en IPC obtener-rounds:", error);
    throw error;
  }
});

ipcMain.handle("db:obtener-planner", async (event, { shiftId, roundId }) => {
  try {
    return await queries.obtenerPlanner(shiftId, roundId);
  } catch (error) {
    console.error("Error en IPC obtener-planner:", error);
    throw error;
  }
});

ipcMain.handle("db:obtener-estudiantes-planner", async (event, plannerId) => {
  try {
    return await queries.obtenerEstudiantesPorPlanner(plannerId);
  } catch (error) {
    console.error("Error en IPC obtener-estudiantes-planner:", error);
    throw error;
  }
});

// Antes de evaluar, garantiza que los alumnos/preguntas online existen en SQLite.
ipcMain.handle("db:asegurar-referencias", async (event, payload) => {
  try {
    await queries.asegurarReferencias(payload);
    return { success: true };
  } catch (error) {
    console.error("❌ Error asegurando referencias locales:", error);
    throw error;
  }
});


ipcMain.removeHandler('db:descargar-preguntas-servidor');
ipcMain.handle('db:descargar-preguntas-servidor', async (event, stationId) => {
  try {
    const apiBase = await settings.getApiBaseUrl();

    const blocksRes = await fetch(`${apiBase}/backend/api/v1/blocks?station_id=${stationId}`);
    const blocksData = await blocksRes.json();
    const block = blocksData?.items?.[0];

    if (!block) throw new Error("No block");

    const questionsRes = await fetch(
      `${apiBase}/backend/api/v1/questions?station_id=${stationId}&block_id=${block.id}&per_page=500`
    );

    const questionsData = await questionsRes.json();
    const rawQuestions = Array.isArray(questionsData) ? questionsData : questionsData.items || [];

    return await db.transaction(async (trx) => {

      await trx('questions').del();

      const rows = rawQuestions.map(q => ({
        id: q.id,
        area: typeof q.area === 'object' ? q.area?.name : q.area || 'General',
        id_station: stationId,
        order: q.order || 0,
        id_block: block?.id ?? null,
        reference: q.question_schema?.reference || '',
        description: q.question_schema?.description || '',
        question_schema: JSON.stringify(q.question_schema || {})
      }));
      // INSERT DB
      //console.log("ROWS DEBUG:", rows[0]);
      console.log("DEBUG: block.id:", block.id);
      console.log("DEBUG: Primera fila:", rows[0]);
      await trx('questions').insert(rows);

      return { success: true, count: rows.length };
    });

  } catch (e) {
    console.error(e);
    throw e;
  }
});

// Obtener Students (Modo Offline) con Knex
ipcMain.removeHandler('db:obtener-estudiantes');
ipcMain.handle('db:obtener-estudiantes', async () => {
  try {
    const rows = await db('students')
      .where({ active: true })
      .select('*')
      .orderBy('planner_order', 'asc');
    
    return rows.map((row, idx) => ({
      id_estudiante: row.id,
      num: row.planner_order || idx + 1,
      name: `${row.surnames || ""}, ${row.name || ""}`.trim().toUpperCase()
    }));
  } catch (error) {
    console.error("❌ Error en Knex al obtener estudiantes:", error);
    throw error;
  }
});
// TODOS Los estudiantes
ipcMain.handle("db:getStudents", async () => {
  try {
    return await db("students")
      .where({ active: true })
      .select("*")
      .orderByRaw("CAST(SUBSTR(dni, 2) AS INTEGER) ASC");
  } catch (error) {
    console.error(error);
    throw error;
  }
});

// 2. Obtener Preguntas (Modo Offline) con Knex
ipcMain.handle('db:obtener-preguntas', async (event, params = {}) => {
  const { stationId, blockId } = params;
  try {
    let query = db('questions').where('active', true);

    if (stationId) {
      query = query.where('id_station', stationId);
    }

    if (blockId) {
      query = query.where('id_block', blockId);
    }

    const rows = await query.orderBy('order', 'asc');

    return rows.map((row) => {
      let schema = {};

      try {
        schema =
          typeof row.question_schema === "string"
            ? JSON.parse(row.question_schema)
            : row.question_schema || {};
      } catch {
        schema = {};
      }

      if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
        schema = {};
      }

      const fromOptions =
        Array.isArray(schema.options) && schema.options.length > 0
          ? Number(schema.options[0].points)
          : null;
      const storedMaxPoints = Number(row.max_points);
      const maxPoints =
        Number.isFinite(storedMaxPoints) && storedMaxPoints > 0
          ? storedMaxPoints
          : fromOptions ?? 0;

      return {
        id: row.id,
        order: row.order,
        max_points: Number.isFinite(maxPoints) ? maxPoints : 0,
        question_schema: {
          ...schema,
          reference: schema.reference ?? row.reference,
          description: schema.description ?? row.description
        },
        area: {
          name: row.area
        }
      };
    });

  } catch (error) {
    console.error("❌ Error obteniendo preguntas:", error);
    throw error;
  }
});

ipcMain.removeHandler('db:obtener-respuestas-alumno');
ipcMain.handle('db:obtener-respuestas-alumno', async (event, { id_student, id_station }) => {
  try {
    const respuestas = await db('resultados')
      .where({ id_student, id_station })
      .select('id_question', 'points');
    return respuestas; // Devolverá un array como: [{ id_question: 1, points: 1 }, ...]
  } catch (error) {
    console.error("❌ Error al recuperar respuestas locales:", error);
    return [];
  }
});

// 3. Guardar o actualizar resultados por alumno + pregunta + estación.
// El índice único de la migración permite un upsert atómico y evita duplicados.
ipcMain.removeHandler('db:guardar-resultado');
ipcMain.handle('db:guardar-resultado', async (event, listaResultados) => {
  if (!Array.isArray(listaResultados) || listaResultados.length === 0) {
    return { success: true, count: 0 };
  }

  const normalizados = listaResultados.map((resultado) => {
    const idStudent = Number(resultado.id_student);
    const idQuestion = Number(resultado.id_question);
    const idStation = Number(resultado.id_station);

    if (![idStudent, idQuestion, idStation].every(Number.isFinite)) {
      throw new Error(
        "Resultado inválido: faltan id_student, id_question o id_station."
      );
    }

    return {
      id_student: idStudent,
      id_question: idQuestion,
      id_station: idStation,
      points: Number.isFinite(Number(resultado.points))
        ? Number(resultado.points)
        : 0,
      answer_schema:
        typeof resultado.answer_schema === "string"
          ? resultado.answer_schema
          : JSON.stringify(resultado.answer_schema || {}),
      sincronizado: false
    };
  });

  return db.transaction(async (trx) => {
    try {
      for (const resultado of normalizados) {
        await trx("resultados")
          .insert(resultado)
          .onConflict(["id_student", "id_question", "id_station"])
          .merge({
            points: resultado.points,
            answer_schema: resultado.answer_schema,
            sincronizado: false,
            evaluado_en: trx.fn.now()
          });
      }

      console.log(
        `💾 ${normalizados.length} respuesta(s) guardada(s) con upsert en SQLite.`
      );
      return { success: true, count: normalizados.length };
    } catch (error) {
      console.error("❌ Error en Knex al guardar el lote de resultados:", error);
      throw error;
    }
  });
});

// -- Envio respuestas el servidor --// 

ipcMain.removeHandler('db:sincronizar-respuestas-al-servidor');
ipcMain.handle('db:sincronizar-respuestas-al-servidor', async (event, token) => {
  if (syncInProgress) {
    return {
      success: false,
      error: "Ya hay una sincronización en curso. Espera a que termine."
    };
  }

  syncInProgress = true;

  try {
    // 1. Extraemos de SQLite todas las respuestas locales que aún NO se han subido
    const registrosPendientes = await db('resultados')
      .where({ sincronizado: false }) // o 0, según guardes el booleano
      .select('*');

    if (registrosPendientes.length === 0) {
      return { success: true, message: "No hay respuestas pendientes de sincronizar.", count: 0 };
    }

    // 2. Mapeamos los datos al formato exacto que te está pidiendo el Swagger
    const payloadParaFastAPI = registrosPendientes.map(row => {
      let schemaParseado = {};
      try {
        // Como en SQLite lo guardamos con JSON.stringify(), lo volvemos a convertir a objeto JSON real
        schemaParseado = typeof row.answer_schema === 'string' 
          ? JSON.parse(row.answer_schema) 
          : row.answer_schema;
      } catch (e) {
        console.error("Error al parsear answer_schema de la fila", row.id, e);
        schemaParseado = { type: "checkbox", selected: [] }; // Fallback de seguridad
      }

      return {
        id_student: Number(row.id_student),
        id_question: Number(row.id_question),
        id_station: Number(row.id_station),
        points: Number(row.points),
        answer_schema: schemaParseado // 🚀 Aquí entra como el objeto que pide Swagger
      };
    });

    console.log(`📡 Enviando un lote masivo de ${payloadParaFastAPI.length} respuestas a FastAPI...`);

    // 3. Enviamos el lote mediante un único POST HTTP masivo.
    const apiBase = await settings.getApiBaseUrl();
    const headers = { "Content-Type": "application/json" };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const signal =
      typeof AbortSignal.timeout === "function"
        ? AbortSignal.timeout(30000)
        : undefined;

    const response = await fetch(
      `${apiBase}/backend/api/v1/answers/bulk-sync`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(payloadParaFastAPI),
        ...(signal ? { signal } : {})
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `El servidor respondió con código ${response.status}: ${errorText}`
      );
    }

    const dataJson = await response.json();
    console.log("🎉 Servidor FastAPI respondió con éxito:", dataJson);

    // 4. Solo marcamos como sincronizado si el servidor confirma TODO el lote.
    const esperados = payloadParaFastAPI.length;
    const procesados = Number(dataJson.inserted_or_updated);

    if (!Number.isFinite(procesados) || procesados < esperados) {
      throw new Error(
        `El servidor confirmó ${dataJson?.inserted_or_updated ?? 0} de ${esperados} respuestas. ` +
          "No se marcarán como sincronizadas y se reintentará el envío."
      );
    }

    const idsSincronizados = registrosPendientes.map((p) => p.id);
    await db("resultados")
      .whereIn("id", idsSincronizados)
      .update({ sincronizado: true });

    return {
      success: true,
      message: `¡Sincronización masiva exitosa! ${procesados} registros subidos.`,
      count: procesados
    };
  } catch (error) {
    console.error(
      "❌ Fallo crítico en el proceso de sincronización masiva:",
      error
    );

    const message =
      error.name === "TimeoutError" || error.name === "AbortError"
        ? "La sincronización tardó más de 30 segundos y se canceló. Se reintentará."
        : error.message;

    return { success: false, error: message };
  } finally {
    syncInProgress = false;
  }
});

// Número de respuestas locales pendientes de subir al servidor.
ipcMain.handle("db:contar-pendientes", async () => {
  try {
    const row = await db("resultados")
      .where({ sincronizado: false })
      .count({ n: "*" })
      .first();

    return Number(row?.n || 0);
  } catch (error) {
    console.error("Error contando respuestas pendientes:", error);
    return 0;
  }
});

// Control de cierre de la app
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});