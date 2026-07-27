import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { notificationsTable, passengersTable, routesTable, stationsTable } from "@workspace/db";
import { eq, desc, and, isNull } from "drizzle-orm";

const router: IRouter = Router();

// GET /api/notifications — list recent notifications for this tenant with student details
router.get("/", async (req, res) => {
  const limit = Math.min(Number(req.query["limit"] ?? 50), 100);
  const rows = await db
    .select({
      id: notificationsTable.id,
      tenantId: notificationsTable.tenantId,
      passengerId: notificationsTable.passengerId,
      type: notificationsTable.type,
      title: notificationsTable.title,
      body: notificationsTable.body,
      readAt: notificationsTable.readAt,
      createdAt: notificationsTable.createdAt,
      passengerName: passengersTable.name,
      passengerPhone: passengersTable.phone,
      className: passengersTable.className,
      section: passengersTable.section,
      rollNumber: passengersTable.rollNumber,
      parentName: passengersTable.parentName,
      routeName: routesTable.name,
      stationName: stationsTable.name,
    })
    .from(notificationsTable)
    .leftJoin(passengersTable, eq(notificationsTable.passengerId, passengersTable.id))
    .leftJoin(routesTable, eq(passengersTable.routeId, routesTable.id))
    .leftJoin(stationsTable, eq(passengersTable.stationId, stationsTable.id))
    .where(eq(notificationsTable.tenantId, req.tenantId))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(limit);
  return res.json(rows);
});

// PATCH /api/notifications/:id/read — mark one notification as read
router.patch("/:id/read", async (req, res) => {
  const id = Number(req.params["id"]);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  await db
    .update(notificationsTable)
    .set({ readAt: new Date() })
    .where(and(eq(notificationsTable.id, id), eq(notificationsTable.tenantId, req.tenantId)));
  return res.json({ ok: true });
});

// POST /api/notifications/read-all — mark all unread as read
router.post("/read-all", async (req, res) => {
  await db
    .update(notificationsTable)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notificationsTable.tenantId, req.tenantId),
        isNull(notificationsTable.readAt),
      ),
    );
  return res.json({ ok: true });
});

export default router;
