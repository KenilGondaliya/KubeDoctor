import pg from "pg";

import { env } from "./env.js";

const { Pool } = pg;

export const db = new Pool({
  connectionString: env.databaseUrl,

  max: 10,

  idleTimeoutMillis: 30000,

  connectionTimeoutMillis: 5000,
});

db.on("error", (error) => {
  console.error("[Observer/PostgreSQL] Unexpected error:", error);
});
