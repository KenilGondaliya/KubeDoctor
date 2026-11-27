import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import "dotenv/config";

const { Pool } = pg;
const databaseUrl =
  process.env.DATABASE_URL ||
  "postgresql://kubedoctor:kubedoctor@127.0.0.1:5433/kubedoctor";

const migrationsDirectory = path.resolve("apps/api/migrations");
const pool = new Pool({ connectionString: databaseUrl });

await pool.query(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`);

const files = fs
  .readdirSync(migrationsDirectory)
  .filter((file) => file.endsWith(".sql"))
  .sort();

for (const file of files) {
  const existing = await pool.query(
    "SELECT 1 FROM schema_migrations WHERE name = $1",
    [file],
  );
  if (existing.rows.length) continue;

  const sql = fs.readFileSync(path.join(migrationsDirectory, file), "utf8");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query(
      "INSERT INTO schema_migrations (name) VALUES ($1)",
      [file],
    );
    await client.query("COMMIT");
    console.log(`[Migration] Applied ${file}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

await pool.end();
