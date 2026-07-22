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

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:Istuti%4098510@db.yhhgfskamrtxwtluochz.supabase.co:5432/postgres";

export const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  options: "-c search_path=public",
});

export const db = drizzle(pool, { schema });

export * from "./schema";
