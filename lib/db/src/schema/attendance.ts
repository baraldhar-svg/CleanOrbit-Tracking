import { pgTable, text, boolean, uuid, date, unique, integer } from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";

export const studentsTable = pgTable("students", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: integer("tenant_id").references(() => tenantsTable.id),
  fullName: text("full_name").notNull(),
  photoUrl: text("photo_url"),
  className: text("class_name"),
  section: text("section"),
  stationName: text("station_name"),
  parentId: uuid("parent_id"),
});

export const attendanceRecordsTable = pgTable("attendance_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id").notNull().references(() => studentsTable.id, { onDelete: "cascade" }),
  date: date("date").defaultNow().notNull(),
  busStatus: text("bus_status").default("PENDING").notNull(), // 'PRESENT', 'ABSENT', 'PENDING'
  classStatus: text("class_status").default("PENDING").notNull(), // 'PRESENT', 'ABSENT', 'PENDING'
  markedByDriver: boolean("marked_by_driver").default(false).notNull(),
  markedByTeacher: boolean("marked_by_teacher").default(false).notNull(),
}, (t) => [
  unique("attendance_records_student_id_date_unique").on(t.studentId, t.date),
]);
