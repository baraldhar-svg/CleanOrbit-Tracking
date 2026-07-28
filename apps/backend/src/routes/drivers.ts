import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { driversTable, usersTable, tenantsTable, routesTable, passengersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { CreateDriverBody, PatchDriverParams, PatchDriverBody } from "@workspace/api-zod";
import { broadcast } from "../lib/sse";
import { normalizePhone, syncUserAndProfiles } from "../lib/sync";

const router: Router = Router();

router.get("/", async (req, res) => {
  const rows = await db
    .select()
    .from(driversTable)
    .where(eq(driversTable.tenantId, req.tenantId));
  res.json(rows);
});

router.get("/active", async (req, res) => {
  const rows = await db
    .select()
    .from(driversTable)
    .where(eq(driversTable.isActive, true))
    .limit(1);
  if (!rows.length) {
    const all = await db.select().from(driversTable).limit(1);
    return res.json(all[0] ?? { id: 1, name: "Ram Bahadur", phone: "+977 9851012345", vehicleNumber: "BA 3 CHA 4567", isActive: true });
  }
  return res.json(rows[0]);
});

// GET /api/drivers/:id/dashboard — Fetch driver's assigned route and strictly route-matched students
router.get("/:id/dashboard", async (req, res) => {
  const driverId = Number(req.params["id"]);
  if (isNaN(driverId)) {
    return res.status(400).json({ success: false, message: "Invalid driver ID" });
  }

  // 1. Fetch driver details
  const [driver] = await db
    .select()
    .from(driversTable)
    .where(and(eq(driversTable.id, driverId), eq(driversTable.tenantId, req.tenantId)))
    .limit(1);

  if (!driver) {
    return res.status(404).json({ success: false, message: "Driver not found" });
  }

  // 2. Fetch route assigned to this driver
  const [assignedRoute] = await db
    .select()
    .from(routesTable)
    .where(and(eq(routesTable.tenantId, req.tenantId), eq(routesTable.driverId, driverId)))
    .limit(1);

  const routeName = assignedRoute?.name ?? "Unassigned Route";
  const routeId = assignedRoute?.id ?? null;

  // 3. Filter students strictly matching this driver's assigned route
  const filteredStudents = routeId != null
    ? await db
        .select({
          id: passengersTable.id,
          name: passengersTable.name,
          phone: passengersTable.phone,
          role: passengersTable.role,
          stationId: passengersTable.stationId,
          routeId: passengersTable.routeId,
          className: passengersTable.className,
          section: passengersTable.section,
          rollNumber: passengersTable.rollNumber,
          status: passengersTable.status,
          boardedAt: passengersTable.boardedAt,
        })
        .from(passengersTable)
        .where(
          and(
            eq(passengersTable.tenantId, req.tenantId),
            eq(passengersTable.role, "student"),
            eq(passengersTable.routeId, routeId)
          )
        )
    : [];

  return res.status(200).json({
    success: true,
    driver: {
      id: driver.id,
      name: driver.name,
      vehicleNumber: driver.vehicleNumber,
      route: routeName,
      routeId,
    },
    assignedStudentsCount: filteredStudents.length,
    notificationsSentTo: filteredStudents,
  });
});

router.post("/", async (req, res) => {
  const parsed = CreateDriverBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.message });
  }
  const { name, photoUrl, gender, vehicleNumber } = parsed.data;
  const phone = normalizePhone(parsed.data.phone);

  // Block duplicate phone before insert (UNIQUE constraint would also catch this)
  const existing = await db.select().from(driversTable).where(eq(driversTable.phone, phone)).limit(1);
  if (existing.length) {
    return res.status(409).json({ error: "A driver with this phone number already exists." });
  }

  const [row] = await db
    .insert(driversTable)
    .values({ tenantId: req.tenantId, name, phone, photoUrl: photoUrl ?? null, gender: gender ?? null, vehicleNumber, isActive: false })
    .returning();

  await syncUserAndProfiles(phone);

  return res.status(201).json(row);
});

router.patch("/:id", async (req, res) => {
  const paramsParsed = PatchDriverParams.safeParse({ id: req.params["id"] });
  if (!paramsParsed.success) {
    return res.status(400).json({ error: "Invalid id", details: paramsParsed.error.issues });
  }
  const bodyParsed = PatchDriverBody.safeParse(req.body);
  if (!bodyParsed.success) {
    return res.status(400).json({ error: "Invalid driver data", details: bodyParsed.error.issues });
  }
  const id = paramsParsed.data.id;
  const { name, phone, vehicleNumber, photoUrl, gender, isActive, isOnline } = bodyParsed.data;
  const updates: Partial<{ name: string; phone: string; vehicleNumber: string; photoUrl: string | null; gender: string | null; isActive: boolean; isOnline: boolean }> = {};
  if (name !== undefined) updates.name = name;
  if (phone !== undefined) updates.phone = phone ? normalizePhone(phone) : undefined;
  if (vehicleNumber !== undefined) updates.vehicleNumber = vehicleNumber;
  if (photoUrl !== undefined) updates.photoUrl = photoUrl;
  if (gender !== undefined) updates.gender = gender;
  if (isActive !== undefined) {
    updates.isActive = isActive;
    if (isActive === true) {
      (updates as any).tripCompletedAt = null;
    }
  }
  if (isOnline !== undefined) updates.isOnline = isOnline;
  const updated = await db
    .update(driversTable)
    .set(updates)
    .where(and(eq(driversTable.id, id), eq(driversTable.tenantId, req.tenantId)))
    .returning();
  if (!updated[0]) { return res.status(404).json({ error: "Driver not found" }); }

  broadcast(req.tenantId, "drivers_updated", { tenantId: req.tenantId, driverId: id });
  if (isActive === true) {
    broadcast(req.tenantId, "driver_activated", { tenantId: req.tenantId, driverId: id, unfreeze: true });
    broadcast(req.tenantId, "trip_started", { tenantId: req.tenantId, driverId: id, adminActivated: true });
  }

  if (updated[0] && updated[0].phone) {
    await syncUserAndProfiles(updated[0].phone);
  }

  return res.json(updated[0]);
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params["id"]);
  const deleted = await db
    .delete(driversTable)
    .where(and(eq(driversTable.id, id), eq(driversTable.tenantId, req.tenantId)))
    .returning();
  if (!deleted[0]) { res.status(404).json({ error: "Driver not found" }); return; }
  res.status(204).end();
});

export default router;
