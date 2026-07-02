const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const queries = require("./src/db/queries");

const isDev = process.env.NODE_ENV === "development";

let mainWindow;
let splashWindow;
let db; 

function getDbPath() {
  return path.join(__dirname, "data", "uvecoe.db");
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
    // 🚀 SOLUCIÓN: Si por lo que sea el servidor no manda el ID, generamos uno basado en tiempo para que no sea NULL
    const idServerValido = usuario.usuario_id_server !== undefined && usuario.usuario_id_server !== null
      ? usuario.usuario_id_server
      : (usuario.id || Date.now()); // Fallback seguro

    // Comprobamos si ya existe el email para evitar romper el UNIQUE
    const usuarioExistente = await db('usuarios').where({ email: usuario.email }).first();

    if (usuarioExistente) {
      // Si ya existe, actualizamos sus datos basándonos en el email
      await db('usuarios')
        .where({ email: usuario.email })
        .update({
          role: usuario.role || 'evaluador',
          token_temporal: usuario.token_temporal || null,
          usuario_id_server: idServerValido
        });
      console.log(`🔄 [KNEX] Sincronizado perfil de usuario existente: ${usuario.email}`);
    } else {
      // Si no existe, lo insertamos asegurando que ningún campo crítico sea undefined/null
      await db('usuarios').insert({
        email: usuario.email,
        role: usuario.role || 'evaluador',
        token_temporal: usuario.token_temporal || null,
        usuario_id_server: idServerValido
      });
      console.log(`💾 [KNEX] Guardado nuevo usuario en el portátil: ${usuario.email}`);
    }
    return { success: true };
  } catch (error) {
    console.error("❌ Error guardando usuario local con validación NOT NULL:", error);
    throw error;
  }
});

ipcMain.removeHandler('db:guardarDatosIniciales');
ipcMain.handle('db:guardarDatosIniciales', async (event, { stationId, id_block, questions, alumnos, usuarios }) => {
  return db.transaction(async (trx) => {
    try {
      console.log(`[SQLITE] Procesando lote en transacción limpia...`);

      // 1. PROCESAR PREGUNTAS
      if (questions && questions.length > 0) {
        await trx('questions').del();
        const preguntasProcesadas = questions.map(q => ({
          id: q.id,
          order: q.order || 0,
          description: q.question_schema?.description || '',
          reference: q.question_schema?.reference || '',
          area: q.area?.name || 'General',
          id_station: stationId || null,
          id_block: id_block,
          question_schema: JSON.stringify(q.question_schema || {})
        }));

        await trx('questions').insert(preguntasProcesadas);
        //console.log("ROWS DEBUG preguntasProcesadas:", preguntasProcesadas[0]);
      }
      
      // 2. 🔥 CORREGIDO: PROCESAR ALUMNOS FILTRANDO CAMPOS BASURA DE LA API ($uri, ecoe, planner)
      if (alumnos && alumnos.length > 0) {
        await trx('alumnos').del(); // Vacíamos la tabla primero
        // Obtener el ID del planner       
        const getPlannerId = (planner) => {
          if (!planner?.$ref) return null;

          const match = planner.$ref.match(/\/(\d+)$/);
          return match ? Number(match[1]) : null;
        };


        const alumnosProcesados = alumnos.map(a => ({
          id: a.id,
          dni: a.dni || '',
          name: a.name || '',
          surnames: a.surnames || '',
          id_planner: getPlannerId(a.planner),
          planner_order: a.planner_order || 0
        }));

        await trx('alumnos').insert(alumnosProcesados);
        //console.log("STUDENTS:", alumnos);
        console.log(`[SQLITE] Insertados ${alumnosProcesados.length} alumnos procesados.`);
        
      }

  // 3. PROCESAR USUARIOS (Blindado contra arrays de roles u objetos vacíos)
  if (usuarios && usuarios.length > 0) {
    await trx('usuarios').truncate();
    
    const usuariosProcesados = usuarios.map(u => {
      // 🚀 BLINDAJE DE ROL: Detectamos si es un array, si viene vacío, o si es un string roto
      let rolDefinitivo = 'evaluador';
      
      if (Array.isArray(u.roles) && u.roles.length > 0) {
        rolDefinitivo = String(u.roles[0]); // Si es un array, toma el primero
      } else if (u.roles && typeof u.roles === 'string') {
        rolDefinitivo = u.roles.trim(); // Si es un string normal, lo limpia
      } else if (u.role && typeof u.role === 'string') {
        rolDefinitivo = u.role.trim(); // Por si en algún caso la propiedad se llama 'role' en singular
      }

      return {
        usuario_id_server: u.id,
        email: u.email,
        role: rolDefinitivo, // Asegura que SIEMPRE sea un string real (nunca un hueco o undefined)
        token_temporal: u.token_temporal || null
      };
  });

  await trx('usuarios').insert(usuariosProcesados); 
  console.log(`[SQLITE] Insertados ${usuariosProcesados.length} usuarios del sistema de forma limpia.`);
}

      console.log("✅ Lote inicial persistido con éxito en SQLite sin campos extra.");
      return { success: true };

    } catch (error) {
      console.error("❌ Error crítico en la transacción de Knex:", error);
      throw error; // Ejecuta automáticamente el ROLLBACK para que no queden datos corruptos
    }
  });
});


ipcMain.removeHandler('db:descargar-preguntas-servidor');
ipcMain.handle('db:descargar-preguntas-servidor', async (event, stationId) => {
  try {

    const blocksRes = await fetch(`http://localhost:8000/backend/api/v1/blocks?station_id=${stationId}`);
    const blocksData = await blocksRes.json();
    const block = blocksData?.items?.[0];

    if (!block) throw new Error("No block");

    const questionsRes = await fetch(
      `http://localhost:8000/backend/api/v1/questions?station_id=${stationId}&block_id=${block.id}&per_page=500`
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
        id_block: block.id,
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

// 1. Obtener Alumnos (Modo Offline) con Knex
ipcMain.removeHandler('db:obtener-alumnos');
ipcMain.handle('db:obtener-alumnos', async () => {
  try {
    const rows = await db('alumnos').select('*').orderBy('planner_order', 'asc');
    
    // Mapeamos al formato que espera tu vista
    return rows.map((row, idx) => ({
      id_estudiante: row.id,
      num: row.planner_order || idx + 1,
      name: `${row.surnames || ""}, ${row.name || ""}`.trim().toUpperCase()
    }));
  } catch (error) {
    console.error("❌ Error en Knex al obtener alumnos:", error);
    throw error;
  }
});
// TODOS Los alumnos
ipcMain.handle("db:getStudents", async () => {
  try {
    return await db("alumnos")
      .select("*")
      //.orderBy("id_planner", "asc");
      .orderByRaw("CAST(SUBSTR(dni, 2) AS INTEGER) ASC");
  } catch (error) {
    console.error(error);
    throw error;
  }
});

// 2. Obtener Preguntas (Modo Offline) con Knex
ipcMain.handle('db:obtener-preguntas', async (event, { stationId, blockId }) => {
  try {
    let query = db('questions');

    if (stationId) {
      query = query.where('id_station', stationId);
    }

    if (blockId) {
      query = query.where('id_block', blockId);
    }

    const rows = await query.orderBy('order', 'asc');

    return rows.map(row => ({
      id: row.id,
      order: row.order,
      question_schema: {
        reference: row.reference,
        description: row.description
      },
      area: {
        name: row.area
      }
    }));

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

// 3. Guardar o Actualizar Resultados por Pregunta (Espejo de FastAPI) con Knex
ipcMain.removeHandler('db:guardar-resultado');
ipcMain.handle('db:guardar-resultado', async (event, listaResultados) => {
  return db.transaction(async (trx) => {
    try {
      // Recorremos el lote de preguntas que nos manda el frontend para ese alumno
      for (const resultado of listaResultados) {
        
        // Buscamos si ya existe una nota previa del alumno para ESTA pregunta concreta
        const existe = await trx('resultados')
          .where({ 
            id_student: resultado.id_student, 
            id_question: resultado.id_question 
          })
          .first();

        if (existe) {
          // Si el médico ha cambiado el switch, actualizamos los puntos y el JSON
          await trx('resultados')
            .where({ id: existe.id })
            .update({
              points: resultado.points,
              answer_schema: resultado.answer_schema,
              sincronizado: false,
              evaluado_en: db.fn.now() // Actualizamos la estampa de tiempo
            });
        } else {
          // Si es la primera vez que se evalúa esta pregunta para el alumno, la insertamos
          await trx('resultados').insert(resultado);
        }
      }

      console.log(`💾 Lote de ${listaResultados.length} respuestas procesado con éxito en SQLite.`);
      return { success: true };
      
    } catch (error) {
      console.error("❌ Error en Knex al guardar el lote de resultados:", error);
      throw error;
    }
  });
});

// Control de cierre de la app
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});