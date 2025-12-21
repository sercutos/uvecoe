const bcrypt = require("bcryptjs");
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
const dbPath = path.join(dataDir, "openecoe_lite.db");
// Abrimos o creamos la base
const db = new Database(dbPath);

// Función para validar usuario con contraseña encriptada
function validateUser(email, password) {
  const user = db.prepare("SELECT id, email, name, password FROM user WHERE email = ?").get(email);

  if (!user) return undefined;

  // Compara password en texto plano con hash
  const match = bcrypt.compareSync(password, user.password); // true o false
  if (!match) return undefined;

  // Retornamos el usuario sin la contraseña
  const { password: _p, ...userWithoutPassword } = user;
  return userWithoutPassword;
}


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
insertDefaultIfEmpty("user", [
  { name: "Usuario por defecto" },
  { name: "Admin" }
]);

insertDefaultIfEmpty("question", [
  { description: "pregunta de prueba", puntos: 1 }
]);

// Obtener todos los usuarios
function getUsers() {
  return db.prepare("SELECT * FROM user").all();
}
// Añadir usuario
function addUser(name) {
  return db.prepare("INSERT INTO user (name) VALUES (?)").run(name);
}
module.exports = {
  getUsers,
  addUser,
  validateUser,
  //addUser, validateUser
};
