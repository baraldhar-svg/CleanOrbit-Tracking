import { pgTable, serial, integer, real, doublePrecision, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { driversTable, tripLogsTable } from "./fleet";

export const gpsLogsTable = pgTable("gps_logs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenantsTable.id, { onDelete: "cascade" }),
  driverId: integer("driver_id")
    .notNull()
    .references(() => driversTable.id, { onDelete: "cascade" }),
  tripId: integer("trip_id")
    .references(() => tripLogsTable.id, { onDelete: "cascade" }),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  speed: real("speed"),
  heading: real("heading"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertGpsLogSchema = createInsertSchema(gpsLogsTable).omit({ id: true });
export type InsertGpsLog = z.infer<typeof insertGpsLogSchema>;
export type GpsLog = typeof gpsLogsTable.$inferSelect;
