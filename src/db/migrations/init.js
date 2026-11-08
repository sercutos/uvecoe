// Migración no-op histórica. Debe permanecer con este nombre porque las bases
// de datos ya creadas la tienen registrada en knex_migrations.
exports.up = async function (knex) {
  // La base de datos ya existe.
};

exports.down = async function (knex) {
  // No hacemos rollback del estado inicial.
};
