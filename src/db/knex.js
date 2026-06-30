const knex = require("knex");
const { app } = require("electron");
const path = require("path");
const fs = require("fs");

// 🚀 Determinar la ruta de la base de datos de manera segura (Desarrollo vs Producción)
let dbPath;

if (app && app.isPackaged) {
  // En producción (instalado), se guarda en AppData / Gnu-Linux HOME / Mac Application Support
  const userDataPath = app.getPath("userData");
  dbPath = path.join(userDataPath, "uvecoe.db");
} else {
  // En desarrollo, usamos la carpeta /data de la raíz del proyecto
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  dbPath = path.join(dataDir, "uvecoe.db");
}

console.log("[DATABASE] Conectando a SQLite en:", dbPath);

const db = knex({
  client: "better-sqlite3",
  connection: {
    filename: dbPath
  },
  useNullAsDefault: true,
  migrations: {
    directory: path.join(__dirname, "migrations"),
    tableName: "knex_migrations"
  },
  pool: {
    afterCreate: (dbConnection, cb) => {
      dbConnection.pragma("foreign_keys = ON");
      cb();
    }
  }
});

module.exports = db;