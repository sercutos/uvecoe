exports.up = async function (knex) {
  const columns = {
    ecoe_name: (table) => table.string("ecoe_name"),
    organization_name: (table) => table.string("organization_name"),
    organization_id: (table) => table.integer("organization_id")
  };

  for (const [name, addColumn] of Object.entries(columns)) {
    if (!(await knex.schema.hasColumn("configuracion", name))) {
      await knex.schema.alterTable("configuracion", addColumn);
    }
  }
};

exports.down = async function (knex) {
  for (const name of ["ecoe_name", "organization_name", "organization_id"]) {
    if (await knex.schema.hasColumn("configuracion", name)) {
      await knex.schema.alterTable("configuracion", (table) => {
        table.dropColumn(name);
      });
    }
  }
};
