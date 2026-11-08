exports.up = async function (knex) {
  for (const tableName of ["questions", "students"]) {
    const hasActive = await knex.schema.hasColumn(tableName, "active");

    if (!hasActive) {
      await knex.schema.alterTable(tableName, (table) => {
        table.boolean("active").notNullable().defaultTo(true);
      });
    }
  }

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS questions_active_station_idx
    ON questions (id_station, active)
  `);

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS students_active_planner_idx
    ON students (active, id_planner, planner_order)
  `);
};

exports.down = async function (knex) {
  await knex.raw(`DROP INDEX IF EXISTS students_active_planner_idx`);
  await knex.raw(`DROP INDEX IF EXISTS questions_active_station_idx`);

  for (const tableName of ["students", "questions"]) {
    const hasActive = await knex.schema.hasColumn(tableName, "active");

    if (hasActive) {
      await knex.schema.alterTable(tableName, (table) => {
        table.dropColumn("active");
      });
    }
  }
};
