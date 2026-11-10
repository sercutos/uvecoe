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
    planners,
    answers
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
            // El backend puede devolver un string ISO o { $date: "..." }.
            time_start: s.time_start?.$date ?? s.time_start
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

      // 4. Respuestas ya existentes en el servidor.
      // Se importan como sincronizadas, pero nunca se sobrescribe una respuesta
      // local pendiente de subir (sincronizado = false).
      const station = toNumber(stationId);
      if (station !== null && Array.isArray(answers) && answers.length > 0) {
        const idsStudents = new Set(
          (students || [])
            .map((student) => Number(student.id))
            .filter(Number.isFinite)
        );
        const idsQuestions = new Set(
          (questions || [])
            .map((question) => Number(question.id))
            .filter(Number.isFinite)
        );

        const porClave = new Map();

        for (const answer of answers) {
          const idStudent = Number(answer.id_student);
          const idQuestion = Number(answer.id_question);
          const idStation = Number(answer.id_station ?? station);

          if (
            !Number.isFinite(idStudent) ||
            !Number.isFinite(idQuestion) ||
            !Number.isFinite(idStation)
          ) {
            continue;
          }

          // Solo respuestas de esta estación y con FKs locales existentes.
          if (idStation !== station) continue;
          if (idsStudents.size > 0 && !idsStudents.has(idStudent)) continue;
          if (idsQuestions.size > 0 && !idsQuestions.has(idQuestion)) continue;

          const answerSchema =
            typeof answer.answer_schema === "string"
              ? answer.answer_schema
              : JSON.stringify(answer.answer_schema || {});

          porClave.set(`${idStudent}:${idQuestion}:${idStation}`, {
            id_student: idStudent,
            id_question: idQuestion,
            id_station: idStation,
            points: Number.isFinite(Number(answer.points))
              ? Number(answer.points)
              : 0,
            answer_schema: answerSchema,
            sincronizado: true,
            sync_batch: null
          });
        }

        if (porClave.size > 0) {
          const pendientes = await trx("resultados")
            .where({ id_station: station })
            .where({ sincronizado: false })
            .select("id_student", "id_question");

          const clavesPendientes = new Set(
            pendientes.map(
              (row) => `${row.id_student}:${row.id_question}:${station}`
            )
          );

          const filas = [...porClave.entries()]
            .filter(([clave]) => !clavesPendientes.has(clave))
            .map(([, fila]) => fila);

          // Insert por lotes para no superar el límite de parámetros de SQLite.
          for (let i = 0; i < filas.length; i += 200) {
            await trx("resultados")
              .insert(filas.slice(i, i + 200))
              .onConflict(["id_student", "id_question", "id_station"])
              .merge(["points", "answer_schema", "sincronizado", "sync_batch"]);
          }
        }
      }

      // 5. Usuarios: el email es la identidad estable.
      // El id del servidor puede cambiar entre ECOEs (o al recrear la BD del
      // servidor), así que no se usa como clave: solo se actualiza el valor.
      if (Array.isArray(users) && users.length > 0) {
        for (const u of users) {
          const email = String(u.email || "").trim().toLowerCase();
          if (!email) continue;

          let rolDefinitivo = "evaluador";
          if (Array.isArray(u.roles) && u.roles.length > 0) {
            rolDefinitivo = String(u.roles[0]);
          } else if (u.roles && typeof u.roles === "string") {
            rolDefinitivo = u.roles.trim();
          } else if (u.role && typeof u.role === "string") {
            rolDefinitivo = u.role.trim();
          }

          const rolesServidor = Array.isArray(u.roles)
            ? u.roles.map(String)
            : typeof u.roles === "string"
              ? [u.roles]
              : [];
          const isSuperadmin =
            u.is_superadmin === true ||
            rolesServidor.includes("superadmin");
          const isAdmin =
            u.is_admin === true ||
            isSuperadmin ||
            rolesServidor.includes("administrator") ||
            rolDefinitivo === "administrator" ||
            rolDefinitivo === "superadmin";
          const organizationId =
            u.id_organization === null || u.id_organization === undefined
              ? null
              : Number(u.id_organization);

          const usuario = {
            usuario_id_server: u.id,
            email,
            role: rolDefinitivo,
            is_admin: isAdmin,
            is_superadmin: isSuperadmin,
            id_organization: Number.isFinite(organizationId)
              ? organizationId
              : null
          };

          if (u.token_temporal !== undefined && u.token_temporal !== null) {
            usuario.token_temporal = u.token_temporal;
          }

          const existentePorEmail = await trx("users")
            .whereRaw("LOWER(email) = ?", [email])
            .first();

          if (existentePorEmail) {
            await trx("users")
              .where({ id: existentePorEmail.id })
              .update(usuario);
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
