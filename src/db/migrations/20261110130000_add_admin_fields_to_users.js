// Datos mínimos para decidir si el usuario puede administrar el portátil
// y para filtrar las ECOEs de su organización en la pantalla de Settings.
exports.up = async function (knex) {
  const hasIsAdmin = await knex.schema.hasColumn("users", "is_admin");
  const hasIsSuperadmin = await knex.schema.hasColumn(
    "users",
    "is_superadmin"
  );
  const hasOrganization = await knex.schema.hasColumn(
    "users",
    "id_organization"
  );

  if (!hasIsAdmin) {
    await knex.schema.alterTable("users", (table) => {
      table.boolean("is_admin").notNullable().defaultTo(false);
    });
  }

  if (!hasIsSuperadmin) {
    await knex.schema.alterTable("users", (table) => {
      table.boolean("is_superadmin").notNullable().defaultTo(false);
    });
  }

  if (!hasOrganization) {
    await knex.schema.alterTable("users", (table) => {
      table.integer("id_organization");
    });
  }

  // Compatibilidad con usuarios guardados antes de estos campos.
  await knex("users")
    .whereIn("role", ["administrator", "superadmin"])
    .update({ is_admin: true });

  await knex("users")
    .where({ role: "superadmin" })
    .update({ is_superadmin: true });
};

exports.down = async function (knex) {
  const columns = ["is_admin", "is_superadmin", "id_organization"];

  for (const column of columns) {
    const exists = await knex.schema.hasColumn("users", column);
    if (exists) {
      await knex.schema.alterTable("users", (table) => {
        table.dropColumn(column);
      });
    }
  }
};
