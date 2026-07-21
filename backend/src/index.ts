import dotenv from "dotenv";
import path from "path";
import fs from "fs";

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

import app from "./app";
import { logger } from "./lib/logger";
import { startCalendarNotifyCron, seedNepalHolidays } from "./routes/calendar";
import { startHeartbeatWatchdog, startDelayWatchdog, startProximityWatchdog } from "./routes/trips";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  seedNepalHolidays().catch((e) =>
    logger.error({ err: e }, "Holiday seed failed"),
  );
  startCalendarNotifyCron((msg) => logger.info(msg));
  startHeartbeatWatchdog();
  startDelayWatchdog();
  startProximityWatchdog();
});
export default app;
