import { pgTable, serial, integer, text, real, doublePrecision, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { vehiclesTable } from "./fleet";

export const vehicleLocationsTable = pgTable("vehicle_locations", {
  id: serial("id").primaryKey(),
  vehicleId: integer("vehicle_id")
    .notNull()
    .unique()
    .references(() => vehiclesTable.id, { onDelete: "cascade" }),
  plateNumber: text("plate_number").notNull(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  speed: real("speed"),
  heading: real("heading"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertVehicleLocationSchema = createInsertSchema(vehicleLocationsTable).omit({ id: true });
export type InsertVehicleLocation = z.infer<typeof insertVehicleLocationSchema>;
export type VehicleLocation = typeof vehicleLocationsTable.$inferSelect;
