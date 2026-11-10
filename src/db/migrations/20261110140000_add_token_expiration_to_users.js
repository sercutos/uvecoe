// Permite saber si el token guardado para el login offline ya caducó.
exports.up = async function (knex) {
  const hasTokenExpiration = await knex.schema.hasColumn(
    "users",
    "token_expires_at"
  );

  if (!hasTokenExpiration) {
    await knex.schema.alterTable("users", (table) => {
      table.string("token_expires_at");
    });
  }
};

exports.down = async function (knex) {
  const hasTokenExpiration = await knex.schema.hasColumn(
    "users",
    "token_expires_at"
  );

  if (hasTokenExpiration) {
    await knex.schema.alterTable("users", (table) => {
      table.dropColumn("token_expires_at");
    });
  }
};
