const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const db = require("./src/db/knex");        
const queries = require("./src/db/queries");

const isDev = process.env.NODE_ENV === "development";

let mainWindow;
let splashWindow;

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
  try {
    console.log("[MIGRACIONES] Comprobando actualizaciones de la base de datos local...");
    
    // Ejecuta las migraciones pendientes usando el Node de Electron nativo
    await db.migrate.latest(); 
    
    console.log("[MIGRACIONES] Base de datos local al día.");
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
ipcMain.handle('db:guardarDatosIniciales', async (event, { preguntas, alumnos, usuarios }) => {
  return db.transaction(async (trx) => {
    try {
      console.log(`[SQLITE] Procesando lote en transacción limpia...`);

      // 1. PROCESAR PREGUNTAS
      if (preguntas && preguntas.length > 0) {
        await trx('preguntas').truncate();
        const preguntasProcesadas = preguntas.map(q => ({
          id: q.id,
          order: q.order || 0,
          description: q.description || '',
          reference: q.reference || '',
          area: (q.area && typeof q.area === 'object') ? (q.area.name || 'General') : (q.area || 'General')
        }));
        await trx('preguntas').insert(preguntasProcesadas);
      }

      // 2. 🔥 CORREGIDO: PROCESAR ALUMNOS FILTRANDO CAMPOS BASURA DE LA API ($uri, ecoe, planner)
      if (alumnos && alumnos.length > 0) {
        await trx('alumnos').truncate(); // Vacíamos la tabla primero

        const alumnosProcesados = alumnos.map(a => ({
          id: a.id,
          dni: a.dni || '',
          name: a.name || '',
          surnames: a.surnames || '',
          planner_order: a.planner_order || 0
          // 🚀 Aquí ignoramos deliberadamente a.$uri, a.ecoe, y a.planner evitando que salte el error
        }));

        await trx('alumnos').insert(alumnosProcesados);
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
    console.log(`[SQLITE] Iniciando descarga de rúbrica para estación: ${stationId}`);

    // ==========================================
    // PASO B ORIGINAL: Obtener el bloque
    // ==========================================
    const blocksRes = await fetch(`http://localhost:8000/backend/api/v1/blocks?station_id=${stationId}`);
    if (!blocksRes.ok) throw new Error(`Error API al traer bloques: ${blocksRes.statusText}`);
    
    const blocksData = await blocksRes.json();
    const block = blocksData?.items?.[0] || (Array.isArray(blocksData) ? blocksData[0] : null);
    
    if (!block) {
      throw new Error(`La estación ${stationId} no tiene bloques configurados.`);
    }

    // ==========================================
    // PASO C ORIGINAL: Obtener preguntas del bloque
    // ==========================================
    const questionsRes = await fetch(`http://localhost:8000/backend/api/v1/questions?station_id=${stationId}&block_id=${block.id}`);
    if (!questionsRes.ok) throw new Error(`Error API al traer preguntas: ${questionsRes.statusText}`);
    
    const questionsData = await questionsRes.json();
    const rawQuestions = Array.isArray(questionsData) ? questionsData : (questionsData.items || []);

    if (rawQuestions.length === 0) {
      return { success: true, count: 0, message: "El bloque vino vacío de preguntas." };
    }

    // ==========================================
    // PERSISTENCIA EN SQLITE: Transacción masiva
    // ==========================================
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        // 1. Limpiamos preguntas anteriores de esa estación para evitar conflictos de id únicos
        db.run("DELETE FROM preguntas", [], (err) => {
          if (err) return reject(err);
        });

        // 2. Preparamos el insert masivo adaptado fielmente al esquema Knex
        const stmt = db.prepare(`
          INSERT INTO preguntas (id, reference, description, area, [order])
          VALUES (?, ?, ?, ?, ?)
        `);

        rawQuestions.forEach((q) => {
          stmt.run(
            q.id,                                      // table.integer("id").primary()
            q.question_schema?.reference || `Q-${q.id}`, // table.string("reference")
            q.question_schema?.description || "",      // table.text("description")
            q.area?.name || "General",                // table.string("area")
            q.order || 0                               // table.integer("order")
          );
        });

        stmt.finalize((err) => {
          if (err) {
            console.error("❌ Error al persistir preguntas masivas:", err);
            reject(err);
          } else {
            console.log(`✅ Sincronizadas con éxito ${rawQuestions.length} preguntas en SQLite.`);
            resolve({ success: true, count: rawQuestions.length });
          }
        });
      });
    });

  } catch (error) {
    console.error("❌ Error en descarga masiva desde API:", error);
    throw error;
  }
});

// 1. Obtener Alumnos (Modo Offline) con Knex
ipcMain.removeHandler('db:obtener-alumnos');
ipcMain.handle('db:obtener-alumnos', async () => {
  try {
    // En Knex: db('tabla').select('*').orderBy('columna', 'asc')
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

// 2. Obtener Preguntas (Modo Offline) con Knex
ipcMain.removeHandler('db:obtener-preguntas');
ipcMain.handle('db:obtener-preguntas', async () => {
  try {
    const rows = await db('preguntas').select('*').orderBy('order', 'asc');
    
    // Reconstruimos la estructura anidada que consume tu front (question_schema y area)
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
    console.error("❌ Error en Knex al obtener preguntas:", error);
    throw error;
  }
})

// 3. Guardar o Actualizar Resultado con Knex
ipcMain.removeHandler('db:guardar-resultado');
ipcMain.handle('db:guardar-resultado', async (event, { alumno_id, evaluacion, sincronizado }) => {
  try {
    // Verificamos si ya existe un examen previo de este alumno
    const existe = await db('resultados').where({ alumno_id }).first();

    if (existe) {
      // Si existe, actualizamos por si corrigió alguna pregunta
      await db('resultados')
        .where({ alumno_id })
        .update({ evaluacion, sincronizado });
      console.log(`💾 Resultado ACTUALIZADO en SQLite para alumno ID: ${alumno_id}`);
    } else {
      // Si no existe, hacemos el insert insertando el registro
      await db('resultados')
        .insert({ alumno_id, evaluacion, sincronizado });
      console.log(`💾 Resultado INSERTADO en SQLite para alumno ID: ${alumno_id}`);
    }

    return { success: true };
  } catch (error) {
    console.error("❌ Error en Knex al guardar resultado:", error);
    throw error;
  }
});

// Control de cierre de la app
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});