import dns from "dns";
import express, { type Express } from "express";
import cors from "cors";
import * as pinoHttp from "pino-http";
import router from "./routes/index.js";
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
app.use(cors());
app.use((req, _res, next) => {
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
  express.json({ limit: "10mb" })(req, res, (err: any) => {
    if (err) return res.status(400).json({ error: "Invalid JSON payload" });
    next();
  });
});

app.use((req: any, res: any, next: any) => {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    return next();
  }
  express.urlencoded({ extended: true, limit: "10mb" })(req, res, (err: any) => {
    if (err) return res.status(400).json({ error: "Invalid form payload" });
    next();
  });
});

app.use("/api", router);

// Default error handler returning clean JSON
app.use((err: any, _req: any, res: any, _next: any) => {
  logger.error({ err }, "Unhandled server error");
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
  });
});

export default app;
