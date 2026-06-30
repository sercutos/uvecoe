/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema
    // 1. TABLA CONFIGURACIÓN (Controla el rol de este portátil específico)
    .createTable("configuracion", (table) => {
      table.increments("id").primary();
      table.integer("ecoe_id").notNullable();
      table.integer("station_id").notNullable();
      table.string("station_name").notNullable();
      table.integer("block_id").notNullable();
    })

    // 2. TABLA USUARIOS (Admin y el evaluador asignado a esta máquina)
    .createTable("usuarios", (table) => {
      table.increments("id").primary();
      table.integer("usuario_id_server").unique().notNullable(); // ID original del backend
      table.string("email").unique().notNullable();
      table.string("role").notNullable(); // 'admin' o 'evaluador'
      table.string("token_temporal"); // Para validar sesiones si se requiere
    })

    // 3. TABLA ALUMNOS (Grupo de alumnos asignados a la estación)
    .createTable("alumnos", (table) => {
      table.integer("id").primary(); // Usamos el mismo ID del estudiante del servidor
      table.string("name").notNullable();
      table.string("surnames").notNullable();
      table.string('dni');
      table.integer("planner_order").notNullable();
    })

    // 4. TABLA PREGUNTAS (Rúbrica/Lista de cotejo de la estación)
    .createTable("questions", (table) => {
      table.integer("id").primary(); // ID de la pregunta del servidor
      table.string("reference");
      table.text("description");
      table.string("area");
      table.integer("order");
    })

    // 5. TABLA RESULTADOS (Evaluaciones hechas por el médico local)
    .createTable("resultados", (table) => {
      table.increments("id").primary();
      table
        .integer("alumno_id")
        .notNullable()
        .references("id")
        .inTable("alumnos")
        .onDelete("CASCADE");
      table
        .integer("question_id")
        .notNullable()
        .references("id")
        .inTable("questions")
        .onDelete("CASCADE");
      table.boolean("checked").notNullable().defaultTo(false); // Sí (true) o No (false)
      
      // 🚀 Crítico para el volcado posterior: cambia a true cuando FastAPI confirme la subida
      table.boolean("sincronizado").notNullable().defaultTo(false); 
      
      table.timestamp("evaluado_en").defaultTo(knex.fn.now());
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  // Eliminamos en orden inverso por las restricciones de claves foráneas
  return knex.schema
    .dropTableIfExists("resultados")
    .dropTableIfExists("questions")
    .dropTableIfExists("alumnos")
    .dropTableIfExists("usuarios")
    .dropTableIfExists("configuracion");
};