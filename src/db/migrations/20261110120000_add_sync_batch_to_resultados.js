// Marca temporal del lote de sincronización. Una escritura nueva la limpia,
// así una respuesta cambiada durante el envío no se marca como sincronizada.
exports.up = async function (knex) {
  const hasSyncBatch = await knex.schema.hasColumn(
    "resultados",
    "sync_batch"
  );

  if (!hasSyncBatch) {
    await knex.schema.alterTable("resultados", (table) => {
      table.text("sync_batch");
    });
  }
};

exports.down = async function (knex) {
  const hasSyncBatch = await knex.schema.hasColumn(
    "resultados",
    "sync_batch"
  );

  if (hasSyncBatch) {
    await knex.schema.alterTable("resultados", (table) => {
      table.dropColumn("sync_batch");
    });
  }
};
