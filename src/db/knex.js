const knex = require("knex");
const { app } = require("electron");
const path = require("path");
const fs = require("fs");

function getDbPath() {
  if (app && app.isPackaged) {
    return path.join(app.getPath("userData"), "uvecoe.db");
  }

  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  return path.join(dataDir, "uvecoe.db");
}

const db = knex({
  client: "better-sqlite3",
  connection: {
    filename: getDbPath()
  },
  useNullAsDefault: true,
  migrations: {
    directory: path.join(__dirname, "../db/migrations"),
    tableName: "knex_migrations"
  },
  pool: {
    afterCreate: (conn, cb) => {
      conn.pragma("foreign_keys = ON");
      cb();
    }
  }
});

module.exports = db;