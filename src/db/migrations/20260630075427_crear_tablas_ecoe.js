exports.up = async function (knex) {
  // 1. TABLA CONFIGURACIÓN (Controla el rol de este portátil específico)
  await knex.schema.createTable("configuracion", (table) => {
    table.increments("id").primary();
    table.integer("ecoe_id").notNullable();
    table.integer("station_id").notNullable();
    table.string("station_name").notNullable();
    table.integer("block_id").notNullable();
  });

  await knex.schema.createTable("usuarios", (table) => {
    // 2. TABLA USUARIOS (Admin y el evaluador asignado a esta máquina)
    table.increments("id").primary();
    table.integer("usuario_id_server").unique().notNullable();
    table.string("email").unique().notNullable();
    table.string("role").notNullable();
    table.string("token_temporal");
  });

  await knex.schema.createTable("alumnos", (table) => {
    // 3. TABLA ALUMNOS (Grupo de alumnos asignados a la estación)
    table.integer("id").primary();
    table.string("name").notNullable();
    table.string("surnames").notNullable();
    table.string("dni");
    table.integer("id_planner");
    table.integer("planner_order").notNullable();
  });

  await knex.schema.createTable("questions", (table) => {
    // 4. TABLA PREGUNTAS (Rúbrica/Lista de cotejo de la estación)
    table.integer("id").primary();

    table.string("area");
    table.integer("id_station");
    table.integer("order");
    table.integer("id_block");

    table.string("reference");
    table.text("description");

    table.json("question_schema");
    
  });

  await knex.schema.createTable("resultados", (table) => {
    // 5. TABLA RESULTADOS (Evaluaciones hechas por el médico local)
    table.increments("id").primary();
    
    // Nombres de campos idénticos a FastAPI para evitar enredos
    table.integer("id_student").notNullable()
      .references("id").inTable("alumnos")
      .onDelete("CASCADE");

    table.integer("id_question").notNullable()
      .references("id").inTable("questions")
      .onDelete("CASCADE");

    table.integer("id_station").notNullable(); // Añadido para cumplir con tu FastAPI

    table.integer("points").defaultTo(0); // Puntos (0 si está desmarcado, 1 o los que correspondan si está marcado)
    
    table.text("answer_schema").notNullable(); // 🚀 Aquí guardaremos el JSON de la respuesta como STRING

    table.boolean("sincronizado").notNullable().defaultTo(false);
    table.timestamp("evaluado_en").defaultTo(knex.fn.now());
  });
};

exports.down = async function (knex) {
    // Eliminamos 
  await knex.schema.dropTableIfExists("resultados");
  await knex.schema.dropTableIfExists("questions");
  await knex.schema.dropTableIfExists("alumnos");
  await knex.schema.dropTableIfExists("usuarios");
  await knex.schema.dropTableIfExists("configuracion");
};