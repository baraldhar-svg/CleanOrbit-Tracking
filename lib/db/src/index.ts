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

let connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres.yhhgfskamrtxwtluochz:Istuti%4098510@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres";

// If process.env.DATABASE_URL contains the IPv6 direct host (db.xxx.supabase.co), replace it with the IPv4 Pooler host for Vercel
if (connectionString.includes("db.yhhgfskamrtxwtluochz.supabase.co")) {
  connectionString =
    "postgresql://postgres.yhhgfskamrtxwtluochz:Istuti%4098510@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres";
}

export const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

export const db = drizzle(pool, { schema });

export * from "./schema";
