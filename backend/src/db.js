import pg from "pg";

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
pool.on("error", (err) => console.error("Database connection lost:", err.message));

export async function initDb() {
  await pool.query(`CREATE TABLE IF NOT EXISTS users (
    username TEXT PRIMARY KEY,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
}
