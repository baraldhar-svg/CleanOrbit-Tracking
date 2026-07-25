const { Pool } = require("pg");

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:Istuti%4098510@db.yhhgfskamrtxwtluochz.supabase.co:5432/postgres";

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  console.log("Connecting to PostgreSQL database...");
  try {
    const client = await pool.connect();
    console.log("Connected successfully! Adding active_session_id columns...");

    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS active_session_id text;
      ALTER TABLE drivers ADD COLUMN IF NOT EXISTS active_session_id text;
    `);

    console.log("SUCCESS! Columns active_session_id added to users and drivers tables.");
    client.release();
    pool.end();
  } catch (err) {
    console.error("Migration FAILED:", err);
  }
}

main();
