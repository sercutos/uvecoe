const db = require("./knex");

const queries = {
  // --- CONSULTAS DE CONFIGURACIÓN ---
  obtenerConfiguracion: async () => {
    // Devuelve la primera fila (ya que solo habrá una) o null si no está configurado
    return db("configuracion").first();
  },

  // --- INSERCIÓN MASIVA DE DATOS DEL ADMINISTRADOR ---
  guardarDatosIniciales: async (stationId, id_block, questions, students, users) => {
    return db.transaction(async (trx) => {

      if (questions && questions.length > 0) {
        await trx('questions').del();
        const preguntasProcesadas = questions.map(q => ({
          id: q.id,
          order: q.order || 0,
          description: q.question_schema?.description || '',
          reference: q.question_schema?.reference || '',
          area: q.area?.name || 'General',
          id_station: stationId || null,
          id_block: id_block ?? null,
          question_schema: JSON.stringify(q.question_schema || {})
        }));
        await trx('questions').insert(preguntasProcesadas);
      }

      if (students && students.length > 0) {
        await trx('students').del();
        const studentsProcessed = students.map(a => ({
          id: a.id,
          dni: a.dni || '',
          name: a.name || '',
          surnames: a.surnames || '',
          id_planner: a.planner?.$ref ? (a.planner.$ref.match(/\/(\d+)$/)?.[1] ?? null) : null,
          planner_order: a.planner_order || 0
        }));
        await trx('students').insert(studentsProcessed);
      }

      if (users && users.length > 0) {
        await trx('users').truncate();
        const usersProcessed = users.map(u => {
          let rolDefinitivo = 'evaluador';
          if (Array.isArray(u.roles) && u.roles.length > 0) {
            rolDefinitivo = String(u.roles[0]);
          } else if (u.roles && typeof u.roles === 'string') {
            rolDefinitivo = u.roles.trim();
          } else if (u.role && typeof u.role === 'string') {
            rolDefinitivo = u.role.trim();
          }
          return {
            usuario_id_server: u.id,
            email: u.email,
            role: rolDefinitivo,
            token_temporal: u.token_temporal || null
          };
        });
        await trx('users').insert(usersProcessed);
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