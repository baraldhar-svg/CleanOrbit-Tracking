import dns from "dns";
import express, { type Express } from "express";
import cors from "cors";
import * as pinoHttp from "pino-http";
import path from "path";
import fs from "fs";
import router from "./routes/index.js";
import webhookRouter from "./routes/webhook.js";
import { logger } from "./lib/logger.js";

if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder("ipv4first");
}

const app: Express = express();
const pinoHttpMiddleware = (pinoHttp as any).default ?? pinoHttp;

app.use(
  pinoHttpMiddleware({
    logger,
    serializers: {
      req(req: any) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res: any) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

let columnsEnsured = false;
export async function ensureDbColumns() {
  if (columnsEnsured) return;
  try {
    const statements = [
      sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS active_session_id text;`,
      sql`ALTER TABLE drivers ADD COLUMN IF NOT EXISTS active_session_id text;`,
      sql`ALTER TABLE drivers ADD COLUMN IF NOT EXISTS trip_completed_at timestamp with time zone;`,
      sql`ALTER TABLE drivers ADD COLUMN IF NOT EXISTS unfrozen_at timestamp with time zone;`,
      sql`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';`,
      sql`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone;`,
      sql`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS sender_role text;`,
      sql`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS sender_name text;`,
      sql`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS metadata json;`,
      // New columns for class teacher configuration
      sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_class_teacher boolean DEFAULT false NOT NULL;`,
      sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS assigned_class text;`,
      sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS assigned_section text;`,
      sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS designation text;`,
      // Create students table
      sql`CREATE TABLE IF NOT EXISTS students (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL,
        full_name TEXT NOT NULL,
        photo_url TEXT,
        class_name TEXT,
        section TEXT,
        station_name TEXT,
        parent_id UUID
      );`,
      // Create attendance_records table
      sql`CREATE TABLE IF NOT EXISTS attendance_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        date DATE DEFAULT CURRENT_DATE NOT NULL,
        bus_status TEXT DEFAULT 'PENDING' CHECK (bus_status IN ('PRESENT', 'ABSENT', 'PENDING')),
        class_status TEXT DEFAULT 'PENDING' CHECK (class_status IN ('PRESENT', 'ABSENT', 'PENDING')),
        marked_by_driver BOOLEAN DEFAULT false NOT NULL,
        marked_by_teacher BOOLEAN DEFAULT false NOT NULL,
        UNIQUE (student_id, date)
      );`,
      // Enable Realtime (Supabase WebSocket)
      sql`ALTER PUBLICATION supabase_realtime ADD TABLE attendance_records;`,
      sql`ALTER PUBLICATION supabase_realtime ADD TABLE students;`,
    ];
    for (const stmt of statements) {
      try {
        await db.execute(stmt);
      } catch (err) {
        logger.warn({ err }, "Individual DB column migration statement warning");
      }
    }
    columnsEnsured = true;
  } catch (e) {
    logger.warn({ err: e }, "DB column check warning");
  }
}

app.use(cors());
app.use(async (req, _res, next) => {
  if (!columnsEnsured) {
    await ensureDbColumns().catch(() => {});
  }
  const raw = req.headers["x-tenant-id"];
  const parsed = raw ? parseInt(String(Array.isArray(raw) ? raw[0] : raw), 10) : NaN;
  req.tenantId = !isNaN(parsed) && parsed > 0 ? parsed : 1;
  next();
});

// Body parsers compatible with Vercel Serverless pre-parsed req.body
app.use((req: any, res: any, next: any) => {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    return next();
  }
  express.json({ limit: "50mb" })(req, res, (err: any) => {
    if (err) return res.status(400).json({ error: err.message || "Invalid JSON payload" });
    next();
  });
});

app.use((req: any, res: any, next: any) => {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    return next();
  }
  express.urlencoded({ extended: true, limit: "50mb" })(req, res, (err: any) => {
    if (err) return res.status(400).json({ error: err.message || "Invalid form payload" });
    next();
  });
});

app.use("/api", router);
app.use("/webhook", webhookRouter);

// Serve frontend static files in production
const staticPaths = [
  path.resolve(import.meta.dirname, "../../frontend/dist"),
  path.resolve(process.cwd(), "apps/frontend/dist"),
  path.resolve(process.cwd(), "../frontend/dist"),
];
let staticPath = "";
for (const p of staticPaths) {
  if (fs.existsSync(p)) {
    staticPath = p;
    break;
  }
}
if (staticPath) {
  logger.info({ staticPath }, "Serving static frontend files");
  app.use(express.static(staticPath));
  app.get(/.*/, (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/webhook")) {
      return next();
    }
    res.sendFile(path.resolve(staticPath, "index.html"));
  });
} else {
  logger.warn("Static frontend path not found. Static serving disabled.");
}

// Default error handler returning clean JSON
app.use((err: any, _req: any, res: any, _next: any) => {
  logger.error({ err }, "Unhandled server error");
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
  });
});

export default app;
