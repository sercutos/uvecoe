const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

// Ruta de la carpeta donde guardamos la BD
const dataDir = path.join(process.cwd(), "data");

// Creamos la carpeta si no existe
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
// Ruta del archivo SQLite
const dbPath = path.join(dataDir, "data.db");

// Abrimos o creamos la base
const db = new Database(dbPath);

// Creamos la tabla 'users' si no existe
db.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
    
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    description TEXT NOT NULL, 
    puntos INTEGER    
  )
`).run();

// Insertar registros por defecto si la tabla está vacía
function insertDefaultIfEmpty(table, defaults) {
  const rowCount = db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count;
  if (rowCount === 0) {
    const insert = db.prepare(
      `INSERT INTO ${table} (${Object.keys(defaults[0]).join(",")}) VALUES (${Object.keys(defaults[0]).map(() => "?").join(",")})`
    );
    const insertMany = db.transaction((rows) => {
      for (const row of rows) insert.run(...Object.values(row));
    });
    insertMany(defaults);
  }
}

// Registros por defecto
insertDefaultIfEmpty("users", [
  { name: "Usuario por defecto" },
  { name: "Admin" }
]);

insertDefaultIfEmpty("questions", [
  { description: "pregunta de pruea", puntos: 1 }
]);


module.exports = {
  getUsers() {
    return db.prepare("SELECT * FROM users").all();
  },

  addUser(name) {
    return db.prepare("INSERT INTO users (name) VALUES (?)").run(name);
  }
};
