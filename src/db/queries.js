const db = require("./knex");

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

// La API devuelve id_planner directamente; planner.$ref es legado.
function mapStudent(student) {
  return {
    id: student.id,
    dni: student.dni || "",
    name: student.name || "",
    surnames: student.surnames || "",
    id_planner:
      student.id_planner ??
      (student.planner?.$ref
        ? Number(student.planner.$ref.match(/\/(\d+)$/)?.[1] ?? null)
        : null),
    planner_order: student.planner_order ?? 0,
    active: true
  };
}

function mapQuestion(question, stationId, idBlock) {
  const schema = question.question_schema || {};
  const fromOptions =
    Array.isArray(schema.options) && schema.options.length > 0
      ? Number(schema.options[0].points)
      : null;
  const storedMaxPoints = Number(question.max_points);
  const maxPoints =
    Number.isFinite(storedMaxPoints) && storedMaxPoints > 0
      ? storedMaxPoints
      : fromOptions ?? 0;

  return {
    id: question.id,
    order: question.order || 0,
    description: schema.description || "",
    reference: schema.reference || "",
    area: question.area?.name || "General",
    id_station: question.id_station ?? stationId ?? null,
    id_block: question.id_block ?? idBlock ?? null,
    max_points: Number.isFinite(maxPoints) ? maxPoints : 0,
    question_schema: JSON.stringify(schema),
    active: true
  };
}

const queries = {
  // --- CONSULTAS DE CONFIGURACIÓN ---
  obtenerConfiguracion: async () => {
    // Devuelve la primera fila (ya que solo habrá una) o null si no está configurado
    return db("configuracion").first();
  },

  // --- INSERCIÓN MASIVA DE DATOS DEL ADMINISTRADOR ---
  // IMPORTANTE: usamos upsert y NO borramos questions/students.
  // Borrarlos dispararía el ON DELETE CASCADE de resultados y perderíamos
  // las evaluaciones ya guardadas.
  guardarDatosIniciales: async ({
    stationId,
    id_block,
    questions,
    students,
    users,
    shifts,
    rounds,
    planners
  }) => {
    return db.transaction(async (trx) => {
      // 1. Planificación: no tiene FKs desde resultados, se puede reemplazar.
      if (Array.isArray(shifts) && shifts.length > 0) {
        await trx("shifts").del();
        await trx("shifts").insert(
          shifts.map((s) => ({
            id: s.id,
            id_ecoe: s.id_ecoe,
            shift_code: s.shift_code,
            time_start: s.time_start
          }))
        );
      }

      if (Array.isArray(rounds) && rounds.length > 0) {
        await trx("rounds").del();
        await trx("rounds").insert(
          rounds.map((r) => ({
            id: r.id,
            id_ecoe: r.id_ecoe,
            round_code: r.round_code,
            description: r.description || null
          }))
        );
      }

      if (Array.isArray(planners) && planners.length > 0) {
        await trx("planners").del();
        await trx("planners").insert(
          planners.map((p) => ({
            id: p.id,
            id_shift: p.id_shift,
            id_round: p.id_round
          }))
        );
      }

      // 2. Preguntas: upsert por id, sin borrar.
      // Las preguntas de la estación que ya no publica el servidor se marcan
      // como inactivas; no se borran para no romper resultados históricos.
      if (Array.isArray(questions) && questions.length > 0) {
        await trx("questions")
          .insert(questions.map((q) => mapQuestion(q, stationId, id_block)))
          .onConflict("id")
          .merge();

        if (stationId !== undefined && stationId !== null) {
          await trx("questions")
            .where({ id_station: stationId })
            .whereNotIn(
              "id",
              questions.map((q) => q.id)
            )
            .update({ active: false });
        }
      }

      // 3. Alumnos: upsert por id, sin borrar.
      // Los alumnos que ya no vienen en la descarga del ECOE se marcan inactivos.
      if (Array.isArray(students) && students.length > 0) {
        await trx("students")
          .insert(students.map(mapStudent))
          .onConflict("id")
          .merge();

        await trx("students")
          .whereNotIn(
            "id",
            students.map((student) => student.id)
          )
          .update({ active: false });
      }

      // 4. Usuarios: upsert preservando el token local si la API no lo envía.
      if (Array.isArray(users) && users.length > 0) {
        for (const u of users) {
          let rolDefinitivo = "evaluador";
          if (Array.isArray(u.roles) && u.roles.length > 0) {
            rolDefinitivo = String(u.roles[0]);
          } else if (u.roles && typeof u.roles === "string") {
            rolDefinitivo = u.roles.trim();
          } else if (u.role && typeof u.role === "string") {
            rolDefinitivo = u.role.trim();
          }

          const usuario = {
            usuario_id_server: u.id,
            email: u.email,
            role: rolDefinitivo
          };

          if (u.token_temporal !== undefined && u.token_temporal !== null) {
            usuario.token_temporal = u.token_temporal;
          }

          const existentePorEmail = await trx("users")
            .where({ email: u.email })
            .first();

          if (existentePorEmail) {
            await trx("users")
              .where({ id: existentePorEmail.id })
              .update(usuario);
            continue;
          }

          const existentePorId = await trx("users")
            .where({ usuario_id_server: u.id })
            .first();

          if (existentePorId) {
            await trx("users")
              .where({ id: existentePorId.id })
              .update({ ...usuario, email: u.email });
          } else {
            await trx("users").insert(usuario);
          }
        }
      }
    });
  },

  // --- GARANTIZAR FKs ANTES DE GUARDAR RESULTADOS ---
  // En modo online, alumnos y preguntas pueden venir de la API y no existir
  // todavía en SQLite. Los upsertamos antes de permitir la evaluación para
  // que las FKs de resultados nunca fallen en silencio.
  asegurarReferencias: async ({ students, questions, stationId, id_block }) => {
    return db.transaction(async (trx) => {
      if (Array.isArray(students) && students.length > 0) {
        await trx("students")
          .insert(students.map(mapStudent))
          .onConflict("id")
          .merge();
      }

      if (Array.isArray(questions) && questions.length > 0) {
        await trx("questions")
          .insert(questions.map((q) => mapQuestion(q, stationId, id_block)))
          .onConflict("id")
          .merge();
      }
    });
  },

  guardarConfiguracion: async (config) => {
    if (config.block_id === undefined || config.block_id === null) {
      throw new Error(
        "No se puede guardar la configuración: la estación no tiene bloque."
      );
    }

    // Transacción: si el insert falla, no perdemos la configuración anterior.
    return db.transaction(async (trx) => {
      await trx("configuracion").del();
      return trx("configuracion").insert({
        ecoe_id: config.ecoe_id,
        station_id: config.station_id,
        station_name: config.station_name,
        block_id: config.block_id,
        station_order: config.station_order ?? null
      });
    });
  },

  // --- CONSULTAS DE USUARIOS ---
  guardarUsuarioLocal: async (usuario) => {
    const fila = {
      usuario_id_server: usuario.id,
      email: usuario.email,
      role: usuario.role
    };

    const token = usuario.token ?? usuario.token_temporal;
    if (token) fila.token_temporal = token;
    if (usuario.password_hash) fila.password_hash = usuario.password_hash;

    return db("users")
      .insert(fila)
      .onConflict("usuario_id_server")
      .merge();
  },

  obtenerUsuarioPorEmail: async (email) => {
    if (!email) return null;

    return db("users")
      .whereRaw("LOWER(email) = ?", [String(email).trim().toLowerCase()])
      .first();
  },

  // --- CONSULTAS DE PLANIFICACIÓN (MODO OFFLINE) ---
  obtenerShifts: async (ecoeId) => {
    const id = toNumber(ecoeId);
    if (id === null) return [];

    return db("shifts").where({ id_ecoe: id }).orderBy("time_start", "asc");
  },

  obtenerRounds: async (ecoeId) => {
    const id = toNumber(ecoeId);
    if (id === null) return [];

    return db("rounds").where({ id_ecoe: id }).orderBy("id", "asc");
  },

  obtenerPlanner: async (shiftId, roundId) => {
    const shift = toNumber(shiftId);
    const round = toNumber(roundId);

    if (shift === null || round === null) return null;

    return db("planners")
      .where({ id_shift: shift, id_round: round })
      .first();
  },

  obtenerEstudiantesPorPlanner: async (plannerId) => {
    const id = toNumber(plannerId);
    if (id === null) return [];

    return db("students")
      .where({ id_planner: id, active: true })
      .orderBy("planner_order", "asc");
  }
};

module.exports = queries;
