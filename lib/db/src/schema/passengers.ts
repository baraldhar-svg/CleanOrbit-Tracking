import { pgTable, serial, text, integer, timestamp, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { stationsTable, routesTable } from "./fleet";

export const passengersTable = pgTable("passengers", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  name: text("name").notNull(),
  phone: text("phone"),
  photoUrl: text("photo_url"),
  role: text("role").notNull().default("student"),
  status: text("status").notNull().default("pending"),
  stationId: integer("station_id").notNull().references(() => stationsTable.id),
  routeId: integer("route_id").references(() => routesTable.id),
  boardedAt: timestamp("boarded_at"),
  liveToday: integer("live_today").notNull().default(0),
  quickMessage: text("quick_message"),
  className: text("class_name"),
  customClass: text("custom_class"),
  section: text("section"),
  rollNumber: text("roll_number"),
  faculty: text("faculty"),
  designation: text("designation"),
  parentName: text("parent_name"),
  gender: text("gender"),
  liveDate: text("live_date"),
  routeSubscribedAt: timestamp("route_subscribed_at"),
  proximityAlertSentAt: timestamp("proximity_alert_sent_at"),
});

export const insertPassengerSchema = createInsertSchema(passengersTable).omit({ id: true, boardedAt: true });
export type InsertPassenger = z.infer<typeof insertPassengerSchema>;
export type Passenger = typeof passengersTable.$inferSelect;

// Boarding audit log — one row per board/absent/unboard action
export const boardingLogsTable = pgTable("boarding_logs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  passengerId: integer("passenger_id").notNull(),
  passengerName: text("passenger_name").notNull(),
  stationId: integer("station_id").notNull(),
  stationName: text("station_name").notNull(),
  driverId: integer("driver_id"),
  driverName: text("driver_name"),
  action: text("action").notNull(), // "boarded" | "absent" | "unboarded"
  actionAt: timestamp("action_at").defaultNow().notNull(),
});

export type BoardingLog = typeof boardingLogsTable.$inferSelect;

// Driver "waiting" notifications — driver pings a student at the upcoming station
export const driverNotificationsTable = pgTable("driver_notifications", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  passengerId: integer("passenger_id").notNull(),
  passengerName: text("passenger_name").notNull(),
  stationId: integer("station_id").notNull(),
  stationName: text("station_name").notNull(),
  driverId: integer("driver_id"),
  driverName: text("driver_name"),
  message: text("message").notNull().default("Driver is waiting for you. Please come to the station."),
  sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
  tripDate: text("trip_date").notNull(), // YYYY-MM-DD, used for per-day dedup
});

export type DriverNotification = typeof driverNotificationsTable.$inferSelect;

// In-app notification log — one row per alert sent to parents/admins
export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  passengerId: integer("passenger_id"),
  type: text("type").notNull(), // "absent" | "delay" | "boarding" | "announcement"
  title: text("title").notNull(),
  body: text("body").notNull(),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Notification = typeof notificationsTable.$inferSelect;

// Expo push tokens — one row per (passenger, device) pair.
// The same physical device token can appear in multiple rows (once per child a
// parent tracks) so the proximity watchdog can fan out to every child on the same
// device without the global-token unique constraint clobbering earlier entries.
// uniqueIndex on (passengerId, token) prevents the same device registering the
// same child more than once while allowing multiple passengers per token.
export const pushTokensTable = pgTable("push_tokens", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  passengerId: integer("passenger_id").notNull(),
  token: text("token").notNull(),
  // "expo" (default, ExponentPushToken[...]) or "fcm" (raw device token from
  // Notifications.getDevicePushTokenAsync(), used if you ever send pushes
  // directly via Firebase instead of Expo's push service).
  provider: text("provider").notNull().default("expo"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex("push_tokens_passenger_token_unique").on(t.passengerId, t.token),
]);

export type PushToken = typeof pushTokensTable.$inferSelect;
