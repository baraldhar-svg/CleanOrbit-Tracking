import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { notificationsTable, passengersTable, routesTable, stationsTable } from "@workspace/db";
import { eq, ne, desc, and, isNull } from "drizzle-orm";
import { broadcast } from "../lib/sse";
import { createNotification } from "../lib/notifications";

const router: IRouter = Router();

// GET /api/notifications — list recent notifications
// For Admin (default): returns inbound student alerts, excluding student-targeted announcements
// For Student (?passengerId=123): returns student-specific notifications (approvals, alerts)
router.get("/", async (req, res) => {
  const limit = Math.min(Number(req.query["limit"] ?? 50), 100);
  const passengerId = req.query["passengerId"] ? Number(req.query["passengerId"]) : null;

  if (passengerId && !isNaN(passengerId)) {
    // Student portal fetching their own notifications
    const rows = await db
      .select({
        id: notificationsTable.id,
        tenantId: notificationsTable.tenantId,
        passengerId: notificationsTable.passengerId,
        type: notificationsTable.type,
        title: notificationsTable.title,
        body: notificationsTable.body,
        status: notificationsTable.status,
        approvedAt: notificationsTable.approvedAt,
        readAt: notificationsTable.readAt,
        createdAt: notificationsTable.createdAt,
      })
      .from(notificationsTable)
      .where(and(eq(notificationsTable.tenantId, req.tenantId), eq(notificationsTable.passengerId, passengerId)))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(limit);
    return res.json(rows);
  }

  // Admin portal Live Alert Log — EXCLUDE student-targeted approval announcements
  const rows = await db
    .select({
      id: notificationsTable.id,
      tenantId: notificationsTable.tenantId,
      passengerId: notificationsTable.passengerId,
      type: notificationsTable.type,
      title: notificationsTable.title,
      body: notificationsTable.body,
      status: notificationsTable.status,
      approvedAt: notificationsTable.approvedAt,
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
    .where(
      and(
        eq(notificationsTable.tenantId, req.tenantId),
        ne(notificationsTable.type, "announcement")
      )
    )
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

// PATCH /api/notifications/:id/approve — admin approves leave application
router.patch("/:id/approve", async (req, res) => {
  const id = Number(req.params["id"]);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const [notif] = await db
    .select()
    .from(notificationsTable)
    .where(and(eq(notificationsTable.id, id), eq(notificationsTable.tenantId, req.tenantId)));

  if (!notif) return res.status(404).json({ error: "Notification not found" });

  const now = new Date();
  await db
    .update(notificationsTable)
    .set({ status: "approved", approvedAt: now, readAt: now })
    .where(and(eq(notificationsTable.id, id), eq(notificationsTable.tenantId, req.tenantId)));

  if (notif.passengerId) {
    void createNotification({
      tenantId: req.tenantId,
      passengerId: notif.passengerId,
      type: "announcement",
      title: "Your Leave Application Has Been Approved ✓",
      body: `Your leave application has been officially approved by School Administration on ${now.toLocaleDateString("en-GB")}.`,
    });

    broadcast(req.tenantId, "leave_application_approved", {
      tenantId: req.tenantId,
      passengerId: notif.passengerId,
      notificationId: id,
      approvedAt: now.toISOString(),
    });
  }

  return res.json({ ok: true, status: "approved", approvedAt: now.toISOString() });
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
