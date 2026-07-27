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
      ALTER TABLE drivers ADD COLUMN IF NOT EXISTS trip_completed_at timestamp with time zone;
      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';
      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone;
    `);

    console.log("SUCCESS! Columns added to users, drivers, and notifications tables.");
    client.release();
    pool.end();
  } catch (err) {
    console.error("Migration FAILED:", err);
  }
}

main();
