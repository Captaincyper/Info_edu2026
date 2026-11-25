import { readFile } from "node:fs/promises";
import pg from "pg";

const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!connectionString) throw new Error("Configure DATABASE_URL before deploying the question board.");

const schema = await readFile(new URL("../db/schema.sql", import.meta.url), "utf8");
const client = new pg.Client({
  connectionString,
  connectionTimeoutMillis: 10000,
  statement_timeout: 15000
});

try {
  await client.connect();
  // Serialize schema setup when two production builds overlap.
  await client.query("BEGIN; SELECT pg_advisory_xact_lock(1082026, 1); " + schema + " COMMIT;");
  console.log("Question board schema is ready.");
} catch (error) {
  throw new Error("Could not initialize the question board database (" + (error.code ?? error.name) + ").");
} finally {
  await client.end();
}
