const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: false }
    : false
});

pool.on("error", (err) => {
  console.error("Erreur PostgreSQL :", err);
});

async function query(text, params) {
  return pool.query(text, params);
}

module.exports = {
  pool,
  query
};