import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { announcementsTable, tenantsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import {
  CreateAnnouncementBody,
  DeleteAnnouncementParams,
} from "@workspace/api-zod";
import { broadcast } from "../lib/sse";

const router: Router = Router();

router.get("/", async (req, res) => {
  const rows = await db
    .select()
    .from(announcementsTable)
    .where(eq(announcementsTable.tenantId, req.tenantId))
    .orderBy(desc(announcementsTable.createdAt));
  res.json(rows);
});

router.post("/", async (req, res) => {
  const parsed = CreateAnnouncementBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.message });
  }
  const { message, messageNe, severity, targetRouteId, targetClass, targetGroup } = parsed.data;
  
  // 1. Save general announcement
  const [row] = await db
    .insert(announcementsTable)
    .values({ tenantId: req.tenantId, message, messageNe: messageNe ?? null, severity: severity ?? "info" })
    .returning();
    
  // 2. If targetRouteId or targetClass is set, create individual targeted notifications
  if (targetRouteId || (targetClass && targetClass !== "All")) {
    const { passengersTable } = await import("@workspace/db");
    const { and, eq } = await import("drizzle-orm");
    const { createNotification } = await import("../lib/notifications");

    let condition = eq(passengersTable.tenantId, req.tenantId);
    if (targetRouteId) {
      condition = and(condition, eq(passengersTable.routeId, targetRouteId)) as any;
    }
    if (targetClass && targetClass !== "All") {
      condition = and(condition, eq(passengersTable.className, targetClass)) as any;
    }

    const targetedPassengers = await db
      .select({ id: passengersTable.id })
      .from(passengersTable)
      .where(condition);

    for (const p of targetedPassengers) {
      void createNotification({
        tenantId: req.tenantId,
        passengerId: p.id,
        type: "announcement",
        title: "Admin Notice",
        body: message,
        senderRole: "admin",
        senderName: "Admin",
        metadata: { announcementId: row.id, routeId: targetRouteId, className: targetClass },
      });
    }
  } else if (targetGroup === "students" && (!targetClass || targetClass === "All")) {
    // Blast to all students
    const { passengersTable } = await import("@workspace/db");
    const { eq } = await import("drizzle-orm");
    const { createNotification } = await import("../lib/notifications");

    const targetedPassengers = await db
      .select({ id: passengersTable.id })
      .from(passengersTable)
      .where(eq(passengersTable.tenantId, req.tenantId));

    for (const p of targetedPassengers) {
      void createNotification({
        tenantId: req.tenantId,
        passengerId: p.id,
        type: "announcement",
        title: "Admin Notice",
        body: message,
        senderRole: "admin",
        senderName: "Admin",
        metadata: { announcementId: row.id },
      });
    }
  }

  broadcast(req.tenantId, "announcements_updated", { tenantId: req.tenantId });
  return res.status(201).json(row);
});

router.delete("/:id", async (req, res) => {
  const parsed = DeleteAnnouncementParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid id" });
  }
  await db.delete(announcementsTable).where(eq(announcementsTable.id, parsed.data.id));
  broadcast(req.tenantId, "announcements_updated", { tenantId: req.tenantId });
  return res.status(204).send();
});

export default router;
