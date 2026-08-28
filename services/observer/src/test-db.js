import { db } from "./config/database.js";

try {
  const result = await db.query(
    "SELECT NOW() AS time"
  );

  console.log(
    "[TEST] PostgreSQL connected:",
    result.rows[0],
  );
} catch (error) {
  console.error(
    "[TEST] PostgreSQL connection failed:",
    error,
  );
} finally {
  await db.end();
}