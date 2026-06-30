const path = require("path");

module.exports = {
  development: {
    client: "better-sqlite3",
    connection: {
      filename: path.join(__dirname, "data", "uvecoe.db")
    },
    useNullAsDefault: true,
    migrations: {
      directory: path.join(__dirname, "src", "db", "migrations"),
      tableName: "knex_migrations"
    },
    pool: {
      afterCreate: (conn, cb) => {
        conn.pragma("foreign_keys = ON");
        cb();
      },
    }
  }
};
