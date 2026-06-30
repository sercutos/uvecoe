const db = require("./knex");

const queries = {
  // --- CONSULTAS DE CONFIGURACIÓN ---
  obtenerConfiguracion: async () => {
    // Devuelve la primera fila (ya que solo habrá una) o null si no está configurado
    return db("configuracion").first();
  },

  // --- 🚀 NUEVO: INSERCIÓN MASIVA DE DATOS DEL ADMINISTRADOR ---
  guardarDatosIniciales: async (preguntas, alumnos, usuarios) => {
    return db.transaction(async (trx) => {
      
      // 1. Limpiamos tablas previas para evitar duplicados si reconfiguran
      await trx("resultados").del();
      await trx("preguntas").del();
      await trx("alumnos").del();
      await trx("usuarios").del(); // 🚀 ¡Nuevo! Limpieza de usuarios anteriores

      // 2. Mapeamos e insertamos los Alumnos
      if (alumnos && alumnos.length > 0) {
        const alumnosMapeados = alumnos.map(a => ({
          id: a.id,
          planner_order: a.planner_order ?? a.orden ?? 0, 
          name: a.name || a.nombre || "",
          surnames: a.surnames || a.apellidos || ""
        }));
        await trx.batchInsert("alumnos", alumnosMapeados, 30);
      }

      // 3. Mapeamos e insertamos las Preguntas
      if (preguntas && preguntas.length > 0) {
        const preguntasMapeadas = preguntas.map(p => ({
          id: p.id,
          reference: p.reference || p.referencia || "",
          description: p.description || p.texto || "",
          area: p.area || "General",
          order: p.order ?? p.orden ?? 0
        }));
        await trx.batchInsert("preguntas", preguntasMapeadas, 30);
      }

      // 4. 🚀 NUEVO: Mapeamos e insertamos los Usuarios de la Organización
      if (usuarios && usuarios.length > 0) {
        const usuariosMapeados = usuarios.map(u => {
          // Determinamos el rol local basándonos en su array de roles del servidor
          const isAdmin = u.roles?.includes("administrator") || u.roles?.includes("superadmin") || u.is_superadmin;
          
          return {
            usuario_id_server: u.id,
            email: u.email,
            role: isAdmin ? "admin" : "evaluador", // 'admin' o 'evaluador' acorde a tu SQLite
            token_temporal: null // Se rellenará cuando hagan login offline si fuera necesario
          };
        });
        await trx.batchInsert("usuarios", usuariosMapeados, 30);
      }
    });
  },

  guardarConfiguracion: async (config) => {
    // Limpiamos la tabla por si acaso ya había una configuración previa
    await db("configuracion").del();
    return db("configuracion").insert({
      ecoe_id: config.ecoe_id,
      station_id: config.station_id,
      station_name: config.station_name,
      block_id: config.block_id
    });
  },

  // --- CONSULTAS DE USUARIOS ---
  guardarUsuarioLocal: async (usuario) => {
    // Inserta o actualiza el usuario del evaluador/admin
    return db("usuarios")
      .insert({
        usuario_id_server: usuario.id,
        email: usuario.email,
        role: usuario.role,
        token_temporal: usuario.token || null
      })
      .onConflict("usuario_id_server")
      .merge();
  },

  obtenerUsuarioPorEmail: async (email) => {
    return db("usuarios").where({ email }).first();
  }
};

module.exports = queries;