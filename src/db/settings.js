const db = require("./knex");

const DEFAULTS = {
  api_base_url: "http://localhost:8000"
};

async function getSetting(key) {
  const row = await db("settings").where({ key }).first();
  return row ? row.value : DEFAULTS[key];
}

async function setSetting(key, value) {
  await db("settings").insert({ key, value }).onConflict("key").merge();
}

async function getApiBaseUrl() {
  return getSetting("api_base_url");
}

module.exports = { getSetting, setSetting, getApiBaseUrl };
