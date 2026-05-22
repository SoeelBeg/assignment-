const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("./webhook.db");

db.serialize(() => {

  db.run(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      type TEXT,
      payload TEXT,
      webhook_url TEXT,
      status TEXT,
      retry_count INTEGER DEFAULT 0,
      next_retry INTEGER,
      created_at TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id TEXT,
      attempted_at TEXT,
      http_status INTEGER,
      outcome TEXT
    )
  `);

});

module.exports = db;