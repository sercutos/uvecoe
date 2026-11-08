exports.up = async function (knex) {
  const hasPasswordHash = await knex.schema.hasColumn("users", "password_hash");

  if (!hasPasswordHash) {
    await knex.schema.alterTable("users", (table) => {
      // Hash bcrypt para verificar el login offline.
      table.string("password_hash");
    });
  }
};

exports.down = async function (knex) {
  const hasPasswordHash = await knex.schema.hasColumn("users", "password_hash");

  if (hasPasswordHash) {
    await knex.schema.alterTable("users", (table) => {
      table.dropColumn("password_hash");
    });
  }
};
