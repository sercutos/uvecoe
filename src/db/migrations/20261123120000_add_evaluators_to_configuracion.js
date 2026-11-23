// Evaluadores que la plataforma asignó a esta estación al descargar los datos.
// Se guardan como JSON [{ id, email }]. Lista vacía = ningún evaluador asignado.
exports.up = async function (knex) {
  const hasEvaluators = await knex.schema.hasColumn(
    "configuracion",
    "evaluators"
  );

  if (!hasEvaluators) {
    await knex.schema.alterTable("configuracion", (table) => {
      table.text("evaluators");
    });
  }
};

exports.down = async function (knex) {
  const hasEvaluators = await knex.schema.hasColumn(
    "configuracion",
    "evaluators"
  );

  if (hasEvaluators) {
    await knex.schema.alterTable("configuracion", (table) => {
      table.dropColumn("evaluators");
    });
  }
};
