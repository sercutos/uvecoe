// El id de usuario del servidor no es estable: puede cambiar entre ECOEs o
// tras reiniciar/recrear la base de datos del servidor. La identidad local
// fiable es el email (también único). Mantener un UNIQUE sobre
// usuario_id_server hace que la descarga inicial falle al reasignar ids.
exports.up = async function (knex) {
  await knex.raw(
    "DROP INDEX IF EXISTS users_usuario_id_server_unique"
  );
};

exports.down = async function (knex) {
  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS users_usuario_id_server_unique
    ON users (usuario_id_server)
  `);
};
