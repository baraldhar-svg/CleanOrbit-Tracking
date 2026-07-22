import dotenv from "dotenv";
import path from "path";
import fs from "fs";

const envPaths = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "../.env"),
  path.resolve(process.cwd(), "../../.env"),
  path.resolve(process.cwd(), "../../../.env"),
];
for (const p of envPaths) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    break;
  }
}

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

let rawUrl = process.env.DATABASE_URL || "";
if (!rawUrl || rawUrl.includes("db.yhhgfskamrtxwtluochz.supabase.co")) {
  // Use Supabase IPv4 Pooler connection string for Vercel/cloud serverless environments
  rawUrl = "postgresql://postgres.yhhgfskamrtxwtluochz:Istuti%4098510@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres";
}

export const pool = new Pool({
  connectionString: rawUrl,
  ssl: { rejectUnauthorized: false },
});

export const db = drizzle(pool, { schema });

export * from "./schema";
