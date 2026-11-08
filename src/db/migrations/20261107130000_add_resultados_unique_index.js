exports.up = async function (knex) {
  // Si ya hubiera duplicados por clics rápidos, conservamos la fila más reciente
  // de cada (alumno, pregunta, estación) antes de crear el índice único.
  await knex.raw(`
    DELETE FROM resultados
    WHERE id NOT IN (
      SELECT MAX(id)
      FROM resultados
      GROUP BY id_student, id_question, id_station
    )
  `);

  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS resultados_unique_student_question_station
    ON resultados (id_student, id_question, id_station)
  `);

  // Acelera la consulta de pendientes de sincronizar.
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS resultados_sincronizado_idx
    ON resultados (sincronizado)
  `);
};

exports.down = async function (knex) {
  await knex.raw(`DROP INDEX IF EXISTS resultados_sincronizado_idx`);
  await knex.raw(
    `DROP INDEX IF EXISTS resultados_unique_student_question_station`
  );
};
