import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { vehiclesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { CreateVehicleBody, PatchVehicleParams, PatchVehicleBody } from "@workspace/api-zod";

const router: Router = Router();
router.get("/", async (req, res) => {
  const rows = await db
    .select()
    .from(vehiclesTable)
    .where(eq(vehiclesTable.tenantId, req.tenantId));
  res.json(rows);
});

router.post("/", async (req, res) => {
  const parsed = CreateVehicleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid vehicle data", details: parsed.error.issues });
    return;
  }
  const { plateNumber, model, capacity, tag } = parsed.data;
  if (!plateNumber.trim() || !model.trim()) {
    res.status(400).json({
      error: "Invalid vehicle data",
      details: [
        ...(!plateNumber.trim() ? [{ path: ["plateNumber"], message: "plateNumber is required" }] : []),
        ...(!model.trim() ? [{ path: ["model"], message: "model is required" }] : []),
      ],
    });
    return;
  }
  const [created] = await db
    .insert(vehiclesTable)
    .values({ tenantId: req.tenantId, plateNumber: plateNumber.trim(), model: model.trim(), capacity: capacity ?? 40, isActive: false, tag: tag ?? null })
    .returning();
  res.status(201).json(created);
});

router.patch("/:id", async (req, res) => {
  const paramsParsed = PatchVehicleParams.safeParse({ id: req.params["id"] });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid id", details: paramsParsed.error.issues });
    return;
  }
  const bodyParsed = PatchVehicleBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: "Invalid vehicle data", details: bodyParsed.error.issues });
    return;
  }
  const { tag } = bodyParsed.data;
  const updated = await db
    .update(vehiclesTable)
    .set({ tag: tag ?? null })
    .where(and(eq(vehiclesTable.id, paramsParsed.data.id), eq(vehiclesTable.tenantId, req.tenantId)))
    .returning();
  if (!updated[0]) { res.status(404).json({ error: "Vehicle not found" }); return; }
  res.json(updated[0]);
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params["id"]);
  const deleted = await db
    .delete(vehiclesTable)
    .where(and(eq(vehiclesTable.id, id), eq(vehiclesTable.tenantId, req.tenantId)))
    .returning();
  if (!deleted[0]) { res.status(404).json({ error: "Vehicle not found" }); return; }
  res.status(204).end();
});

export default router;
