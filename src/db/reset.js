const fs = require("fs");
const path = require("path");

function resetDatabase(dbPath) {
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    console.log("[DEV] SQLite eliminada:", dbPath);
  }
}

module.exports = { resetDatabase };