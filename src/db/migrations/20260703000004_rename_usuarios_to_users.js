exports.up = async function (knex) {
  const hasUsuarios = await knex.schema.hasTable("usuarios");
  if (!hasUsuarios) return;

  const oldUsuarios = await knex("usuarios").select("*");

  await knex.schema.dropTableIfExists("usuarios");

  await knex.schema.createTable("users", (table) => {
    table.increments("id").primary();
    table.integer("usuario_id_server").unique().notNullable();
    table.string("email").unique().notNullable();
    table.string("role").notNullable();
    table.string("token_temporal");
  });

  if (oldUsuarios.length > 0) {
    await knex("users").insert(oldUsuarios);
  }
};

exports.down = async function (knex) {
  const hasUsers = await knex.schema.hasTable("users");
  if (!hasUsers) return;

  const oldUsers = await knex("users").select("*");

  await knex.schema.dropTableIfExists("users");

  await knex.schema.createTable("usuarios", (table) => {
    table.increments("id").primary();
    table.integer("usuario_id_server").unique().notNullable();
    table.string("email").unique().notNullable();
    table.string("role").notNullable();
    table.string("token_temporal");
  });

  if (oldUsers.length > 0) {
    await knex("usuarios").insert(oldUsers);
  }
};
