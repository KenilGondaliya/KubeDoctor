import pg from "pg";
import { env } from "../config/env.js";

const { Pool } = pg;

export const db = new Pool({
  connectionString: env.databaseUrl,

  max: 20,

  idleTimeoutMillis: 30_000,

  connectionTimeoutMillis: 5_000,
});

db.on("error", (error) => {
  console.error("[PostgreSQL] Unexpected error:", error);
});

export async function checkDatabaseConnection() {
  const result = await db.query("SELECT NOW() AS now");

  return result.rows[0];
}
