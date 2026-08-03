import { Router } from "express";
import { db } from "@workspace/db";
import { studentsTable, attendanceRecordsTable } from "@workspace/db";
import { eq, and, gt, desc, sql } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { broadcast } from "../lib/sse.js";

const router: Router = Router();

/**
 * GET /api/attendance/students
 * Fetch students for a school. Can filter by className and section.
 */
router.get("/students", async (req, res) => {
  try {
    const tenantId = req.tenantId || 1;
    const { className, section } = req.query as { className?: string; section?: string };

    let query = db.select().from(studentsTable).where(eq(studentsTable.tenantId, tenantId));
    const conditions = [];

    if (className) conditions.push(eq(studentsTable.className, className));
    if (section) conditions.push(eq(studentsTable.section, section));

    if (conditions.length > 0) {
      // @ts-ignore
      query = query.where(and(eq(studentsTable.tenantId, tenantId), ...conditions));
    }

    const students = await query;
    return res.json(students);
  } catch (err: any) {
    logger.error({ err }, "Error fetching students");
    return res.status(500).json({ error: "Failed to fetch students" });
  }
});

/**
 * GET /api/attendance/status
 * Combined endpoint returning students merged with their attendance status for a given date.
 */
router.get("/status", async (req, res) => {
  try {
    const tenantId = req.tenantId || 1;
    const { className, section, stationName, date: dateParam } = req.query as { className?: string; section?: string; stationName?: string; date?: string };
    const dateValue = dateParam || new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    // 1. Fetch students for this school
    let studentQuery = db.select().from(studentsTable).where(eq(studentsTable.tenantId, tenantId));
    const conditions = [];

    if (className) conditions.push(eq(studentsTable.className, className));
    if (section) conditions.push(eq(studentsTable.section, section));
    if (stationName) conditions.push(eq(studentsTable.stationName, stationName));

    if (conditions.length > 0) {
      // @ts-ignore
      studentQuery = studentQuery.where(and(eq(studentsTable.tenantId, tenantId), ...conditions));
    }
    const students = await studentQuery;

    // 2. Fetch attendance records for today
    const studentIds = students.map(s => s.id);
    let records: Array<typeof attendanceRecordsTable.$inferSelect> = [];
    
    if (studentIds.length > 0) {
      records = await db
        .select()
        .from(attendanceRecordsTable)
        .where(
          and(
            eq(attendanceRecordsTable.date, dateValue),
            sql`${attendanceRecordsTable.studentId} IN ${studentIds}`
          )
        );
    }

    // 3. Map records by studentId
    const recordMap = new Map(records.map(r => [r.studentId, r]));

    // 4. Merge students with attendance
    const result = students.map(student => {
      const record = recordMap.get(student.id);
      return {
        studentId: student.id,
        fullName: student.fullName,
        photoUrl: student.photoUrl,
        className: student.className,
        section: student.section,
        stationName: student.stationName,
        parentId: student.parentId,
        date: dateValue,
        busStatus: record?.busStatus ?? 'PENDING',
        classStatus: record?.classStatus ?? 'PENDING',
        markedByDriver: record?.markedByDriver ?? false,
        markedByTeacher: record?.markedByTeacher ?? false,
        attendanceId: record?.id ?? null,
      };
    });

    return res.json(result);
  } catch (err: any) {
    logger.error({ err }, "Error fetching attendance status");
    return res.status(500).json({ error: "Failed to fetch attendance status" });
  }
});

/**
 * GET /api/attendance/station-students
 * Fetch students mapped to a specific geofenced station for the driver.
 */
router.get("/station-students", async (req, res) => {
  try {
    const tenantId = req.tenantId || 1;
    const { stationName } = req.query as { stationName?: string };

    if (!stationName) {
      return res.status(400).json({ error: "stationName is required" });
    }

    const students = await db
      .select()
      .from(studentsTable)
      .where(
        and(
          eq(studentsTable.tenantId, tenantId),
          eq(studentsTable.stationName, stationName)
        )
      );

    return res.json(students);
  } catch (err: any) {
    logger.error({ err }, "Error fetching station students");
    return res.status(500).json({ error: "Failed to fetch station students" });
  }
});

/**
 * POST /api/attendance/mark
 * Batch mark/upsert student attendance records.
 */
router.post("/mark", async (req, res) => {
  try {
    const tenantId = req.tenantId || 1;
    const { records } = req.body as {
      records: Array<{
        studentId: string;
        date?: string;
        busStatus?: 'PRESENT' | 'ABSENT' | 'PENDING';
        classStatus?: 'PRESENT' | 'ABSENT' | 'PENDING';
        markedByDriver?: boolean;
        markedByTeacher?: boolean;
      }>;
    };

    if (!records || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: "Invalid records payload" });
    }

    const todayStr = new Date().toISOString().split("T")[0];

    const upsertPromises = records.map(async (record) => {
      const dateValue = record.date || todayStr;

      return db
        .insert(attendanceRecordsTable)
        .values({
          studentId: record.studentId,
          date: dateValue,
          busStatus: record.busStatus ?? 'PENDING',
          classStatus: record.classStatus ?? 'PENDING',
          markedByDriver: record.markedByDriver ?? false,
          markedByTeacher: record.markedByTeacher ?? false,
        })
        .onConflictDoUpdate({
          target: [attendanceRecordsTable.studentId, attendanceRecordsTable.date],
          set: {
            busStatus: record.busStatus !== undefined ? record.busStatus : sql`bus_status`,
            classStatus: record.classStatus !== undefined ? record.classStatus : sql`class_status`,
            markedByDriver: record.markedByDriver !== undefined ? record.markedByDriver : sql`marked_by_driver`,
            markedByTeacher: record.markedByTeacher !== undefined ? record.markedByTeacher : sql`marked_by_teacher`,
          }
        })
        .returning();
    });

    const results = await Promise.all(upsertPromises);

    // Broadcast realtime event to frontend clients listening to the school
    try {
      broadcast(tenantId, "passengers_updated", {
        type: "attendance_marked",
        count: results.length
      });
    } catch (e) {
      logger.warn({ err: e }, "SSE broadcast failed for attendance update");
    }

    return res.json({ success: true, results });
  } catch (err: any) {
    logger.error({ err }, "Error marking attendance");
    return res.status(500).json({ error: "Failed to mark attendance" });
  }
});

// Explicit cast to Router to avoid Express type export issues
export default router as Router;
