exports.up = async function (knex) {
  // Turnos del ECOE (para poder seleccionar fecha/turno sin red)
  await knex.schema.createTable("shifts", (table) => {
    table.integer("id").primary();
    table.integer("id_ecoe").notNullable();
    table.string("shift_code").notNullable();
    table.string("time_start").notNullable();
    table.index(["id_ecoe", "time_start"]);
  });

  // Rondas del ECOE
  await knex.schema.createTable("rounds", (table) => {
    table.integer("id").primary();
    table.integer("id_ecoe").notNullable();
    table.string("round_code").notNullable();
    table.string("description");
    table.index(["id_ecoe"]);
  });

  // Planificadores: cada planner une un turno con una ronda y agrupa 12 alumnos
  await knex.schema.createTable("planners", (table) => {
    table.integer("id").primary();
    table.integer("id_shift").notNullable();
    table.integer("id_round").notNullable();
    table.index(["id_shift", "id_round"]);
  });

  // Orden de la estación dentro de la rotación (1..12)
  const hasStationOrder = await knex.schema.hasColumn(
    "configuracion",
    "station_order"
  );

  if (!hasStationOrder) {
    await knex.schema.alterTable("configuracion", (table) => {
      table.integer("station_order");
    });
  }

  // Acelera la búsqueda de los 12 alumnos de un planner en orden de rotación
  await knex.schema.alterTable("students", (table) => {
    table.index(
      ["id_planner", "planner_order"],
      "students_planner_order_idx"
    );
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable("students", (table) => {
    table.dropIndex(
      ["id_planner", "planner_order"],
      "students_planner_order_idx"
    );
  });

  await knex.schema.alterTable("configuracion", (table) => {
    table.dropColumn("station_order");
  });

  await knex.schema.dropTableIfExists("planners");
  await knex.schema.dropTableIfExists("rounds");
  await knex.schema.dropTableIfExists("shifts");
};
