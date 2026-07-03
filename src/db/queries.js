const db = require("./knex");

const queries = {
  // --- CONSULTAS DE CONFIGURACIÓN ---
  obtenerConfiguracion: async () => {
    // Devuelve la primera fila (ya que solo habrá una) o null si no está configurado
    return db("configuracion").first();
  },

  // --- 🚀 NUEVO: INSERCIÓN MASIVA DE DATOS DEL ADMINISTRADOR ---
  guardarDatosIniciales: async (questions, students, users) => {
    return db.transaction(async (trx) => {
      
      // 1. Limpiamos tablas previas para evitar duplicados si reconfiguran
      await trx("resultados").del();
      await trx("questions").del();
      await trx("students").del();
      await trx("users").del();

      // 2. Mapeamos e insertamos los Alumnos
      if (students && students.length > 0) {
        const studentsMapped = students.map(a => ({
          id: a.id,
          id_planner: a.id_planner,
          planner_order: a.planner_order ?? a.orden ?? 0, 
          name: a.name || a.nombre || "",
          surnames: a.surnames || a.apellidos || ""
        }));
        console.log("STUDENTS:", studentsMapped);
        await trx.batchInsert("students", studentsMapped, 30);
      }

      // 3. Mapeamos e insertamos las Preguntas
      if (questions && questions.length > 0) {
        const preguntasMapeadas = questions.map(p => ({
          id: p.id,
          reference: p.reference || p.referencia || "",
          description: p.description || p.texto || "",
          area: p.area || "General",
          order: p.order ?? p.orden ?? 0
        }));
        await trx.batchInsert("questions", preguntasMapeadas, 30);
      }

      // 4. Mapeamos e insertamos los Usuarios de la Organización
      if (users && users.length > 0) {
        const usersMapped = users.map(u => {
          const isAdmin = u.roles?.includes("administrator") || u.roles?.includes("superadmin") || u.is_superadmin;
          
          return {
            usuario_id_server: u.id,
            email: u.email,
            role: isAdmin ? "admin" : "evaluador",
            token_temporal: null
          };
        });
        await trx.batchInsert("users", usersMapped, 30);
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
    return db("users")
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
    return db("users").where({ email }).first();
  }
};

module.exports = queries;