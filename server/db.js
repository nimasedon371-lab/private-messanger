
const { Pool } = require("pg");
const path = require("path");

require("dotenv").config({
  path: path.join(__dirname, ".env"),
});

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DB_SSL === "true"
        ? { rejectUnauthorized: false }
        : undefined,
    })
  : new Pool({
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      port: Number(process.env.DB_PORT || 5432),
    });

pool.on("error", (err) => {
  console.error("Unexpected PostgreSQL error:", err.message);
});

module.exports = pool;