import express, { type Express } from "express";
import cors from "cors";
import * as pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

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
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use("/api", router);

export default app;
