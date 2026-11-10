// Los puntos ya no se duplican en local: se leen de question_schema.options[0].points.
// La migración histórica que creó y rellenó la columna se mantiene para DBs antiguas.
exports.up = async function (knex) {
  const hasMaxPoints = await knex.schema.hasColumn("questions", "max_points");

  if (hasMaxPoints) {
    await knex.schema.alterTable("questions", (table) => {
      table.dropColumn("max_points");
    });
  }
};

exports.down = async function (knex) {
  const hasMaxPoints = await knex.schema.hasColumn("questions", "max_points");

  if (!hasMaxPoints) {
    await knex.schema.alterTable("questions", (table) => {
      table.float("max_points").defaultTo(0);
    });
  }
};
