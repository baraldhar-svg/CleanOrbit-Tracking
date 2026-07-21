import { pgTable, serial, text, integer } from "drizzle-orm/pg-core";

export const advertisementsTable = pgTable("advertisements", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  imageUrl: text("image_url").notNull(),
  targetUrl: text("target_url"),
  tenantId: integer("tenant_id"),
  sortOrder: integer("sort_order").default(0).notNull(),
  active: integer("active").default(1).notNull(),
});

export type Advertisement = typeof advertisementsTable.$inferSelect;

export const adRequestsTable = pgTable("ad_requests", {
  id: serial("id").primaryKey(),
  advertiserName: text("advertiser_name").notNull(),
  contactPerson: text("contact_person"),
  phone: text("phone").notNull(),
  email: text("email"),
  adTitle: text("ad_title").notNull(),
  subtitle: text("subtitle"),
  imageUrl: text("image_url").notNull(),
  targetUrl: text("target_url"),
  daysRequested: integer("days_requested").notNull().default(1),
  costNpr: integer("cost_npr").notNull().default(500),
  status: text("status").notNull().default("pending"),
  rejectionReason: text("rejection_reason"),
  createdAt: text("created_at").notNull(),
  startDate: text("start_date"),
  endDate: text("end_date"),
});

export type AdRequest = typeof adRequestsTable.$inferSelect;
