const db = require("./knex");

const DEFAULTS = {
  api_base_url: "https://sauron.uv.es"
};

async function getSetting(key) {
  const row = await db("settings").where({ key }).first();
  return row ? row.value : DEFAULTS[key];
}

async function setSetting(key, value) {
  await db("settings").insert({ key, value }).onConflict("key").merge();
}

// La app añade /backend por su cuenta; acepta la URL pegada con esa parte.
function normalizeApiBaseUrl(value) {
  return String(value || "")
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/backend(\/api(\/v1)?)?$/i, "");
}

async function getApiBaseUrl() {
  return normalizeApiBaseUrl(await getSetting("api_base_url"));
}

module.exports = { getSetting, setSetting, getApiBaseUrl };
