exports.up = async function (knex) {
  await knex.schema.createTable("settings", (table) => {
    table.string("key").primary();
    table.text("value");
  });

  await knex("settings").insert({
    key: "api_base_url",
    value: "http://localhost:8000"
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("settings");
};
