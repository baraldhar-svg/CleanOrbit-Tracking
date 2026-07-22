import dotenv from "dotenv";
import path from "path";
import fs from "fs";

// Load .env variables if present
const envPaths = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "../.env"),
];
for (const p of envPaths) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    break;
  }
}

// Fallback environment variables for Vercel deployment
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://postgres:Istuti%4098510@db.yhhgfskamrtxwtluochz.supabase.co:5432/postgres";
}
if (!process.env.SESSION_SECRET) {
  process.env.SESSION_SECRET = "dev_secret_session_key_for_local_testing";
}

import app from "../backend/src/app";

export default app;
