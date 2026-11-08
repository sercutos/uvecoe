exports.up = async function (knex) {
  // Las instalaciones que ya tienen una estación configurada no deben volver
  // a pasar por el asistente inicial.
  const configuracion = await knex("configuracion").first();
  const value = configuracion ? "true" : "false";

  await knex("settings")
    .insert({ key: "setup_completed", value })
    .onConflict("key")
    .merge();
};

exports.down = async function (knex) {
  await knex("settings").where({ key: "setup_completed" }).del();
};
