    const path = require("path");
    const knex = require("knex");
    const { app } = require("electron");
    const path = require("path");
    const fs = require("fs");
    // Ruta de la carpeta donde guardamos la BD
    const dataDir = path.join(process.cwd(), "data");
    // Ruta del archivo SQLite
    const dbPath = path.join(dataDir, "openecoe_lite.db");


    const db = knex({
    client: "better-sqlite3",
    connection: {
        filename: dbPath
    },
    useNullAsDefault: true,
    migrations: {
        directory: path.join(__dirname, "src/db/migrations"),
        tableName: "knex_migrations"
    }
    });

    module.exports = db;
