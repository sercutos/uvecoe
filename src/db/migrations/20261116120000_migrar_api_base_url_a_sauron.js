const LEGACY = "http://localhost:8000";
const REMOTE = "https://sauron.uv.es";

// El default antiguo apuntaba a localhost; el servidor real está en sauron.
// Solo se toca el valor exacto antiguo, respetando cualquier URL ya personalizada.
exports.up = async function (knex) {
  await knex("settings")
    .where({ key: "api_base_url", value: LEGACY })
    .update({ value: REMOTE });
};

exports.down = async function (knex) {
  await knex("settings")
    .where({ key: "api_base_url", value: REMOTE })
    .update({ value: LEGACY });
};
