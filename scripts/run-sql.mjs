// Run SQL files against the Supabase database in DATABASE_URL (.env.local).
// Usage: node scripts/run-sql.mjs supabase/migrations/0012_xxx.sql [more.sql ...]
// Each file runs as one transaction; the schema cache is reloaded afterwards.
import fs from "node:fs";
import pg from "pg";

const env = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)?.[1].trim();
if (!url) throw new Error("DATABASE_URL missing from .env.local");

const files = process.argv.slice(2);
if (files.length === 0) throw new Error("Pass at least one .sql file");

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  for (const file of files) {
    await client.query("begin");
    try {
      await client.query(fs.readFileSync(file, "utf8"));
      await client.query("commit");
      console.log(`ok   ${file}`);
    } catch (err) {
      await client.query("rollback");
      console.error(`FAIL ${file}: ${err.message}`);
      process.exitCode = 1;
      break;
    }
  }
  await client.query("notify pgrst, 'reload schema'");
} finally {
  await client.end();
}
