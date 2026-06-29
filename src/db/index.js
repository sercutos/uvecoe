const db = require("./knex");

async function initDB() {
  await db.migrate.latest();
}

module.exports = {
  db,
  initDB
};
