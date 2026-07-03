exports.up = async function (knex) {
  const hasAlumnos = await knex.schema.hasTable("alumnos");
  if (!hasAlumnos) return;

  // SQLite no permite ALTER TABLE con FKs, así que guardamos data y recreamos
  const oldResultados = await knex("resultados").select("*");
  const oldAlumnos = await knex("alumnos").select("*");

  await knex.schema.dropTableIfExists("resultados");
  await knex.schema.dropTableIfExists("alumnos");

  await knex.schema.createTable("students", (table) => {
    table.integer("id").primary();
    table.string("name").notNullable();
    table.string("surnames").notNullable();
    table.string("dni");
    table.integer("id_planner");
    table.integer("planner_order").notNullable();
  });

  if (oldAlumnos.length > 0) {
    await knex("students").insert(oldAlumnos);
  }

  await knex.schema.createTable("resultados", (table) => {
    table.increments("id").primary();
    table.integer("id_student").notNullable()
      .references("id").inTable("students")
      .onDelete("CASCADE");
    table.integer("id_question").notNullable()
      .references("id").inTable("questions")
      .onDelete("CASCADE");
    table.integer("id_station").notNullable();
    table.integer("points").defaultTo(0);
    table.text("answer_schema").notNullable();
    table.boolean("sincronizado").notNullable().defaultTo(false);
    table.timestamp("evaluado_en").defaultTo(knex.fn.now());
  });

  if (oldResultados.length > 0) {
    await knex("resultados").insert(oldResultados);
  }
};

exports.down = async function (knex) {
  const hasStudents = await knex.schema.hasTable("students");
  if (!hasStudents) return;

  const oldResultados = await knex("resultados").select("*");
  const oldStudents = await knex("students").select("*");

  await knex.schema.dropTableIfExists("resultados");
  await knex.schema.dropTableIfExists("students");

  await knex.schema.createTable("alumnos", (table) => {
    table.integer("id").primary();
    table.string("name").notNullable();
    table.string("surnames").notNullable();
    table.string("dni");
    table.integer("id_planner");
    table.integer("planner_order").notNullable();
  });

  if (oldStudents.length > 0) {
    await knex("alumnos").insert(oldStudents);
  }

  await knex.schema.createTable("resultados", (table) => {
    table.increments("id").primary();
    table.integer("id_student").notNullable()
      .references("id").inTable("alumnos")
      .onDelete("CASCADE");
    table.integer("id_question").notNullable()
      .references("id").inTable("questions")
      .onDelete("CASCADE");
    table.integer("id_station").notNullable();
    table.integer("points").defaultTo(0);
    table.text("answer_schema").notNullable();
    table.boolean("sincronizado").notNullable().defaultTo(false);
    table.timestamp("evaluado_en").defaultTo(knex.fn.now());
  });

  if (oldResultados.length > 0) {
    await knex("resultados").insert(oldResultados);
  }
};
