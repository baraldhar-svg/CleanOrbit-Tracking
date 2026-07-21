import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { stationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateStationBody, DeleteStationParams } from "@workspace/api-zod";

const router: Router = Router();
router.get("/", async (req, res) => {
  const rows = await db
    .select()
    .from(stationsTable)
    .where(eq(stationsTable.tenantId, req.tenantId));
  res.json(rows);
});

router.post("/", async (req, res) => {
  const parsed = CreateStationBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.message });
  }
  const { name, lat, lng, radius } = parsed.data as { name: string; lat: number; lng: number; radius?: number };
  const [row] = await db
    .insert(stationsTable)
    .values({ tenantId: req.tenantId, name, lat, lng, radius: radius ?? 200 })
    .returning();
  return res.status(201).json(row);
});

router.patch("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const body = req.body as Partial<{ name: string; lat: number; lng: number; radius: number }>;
  const updates: Record<string, unknown> = {};
  if (body.name   != null) updates.name   = body.name;
  if (body.lat    != null) updates.lat    = body.lat;
  if (body.lng    != null) updates.lng    = body.lng;
  if (body.radius != null) updates.radius = body.radius;
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: "No fields to update" });
  const [row] = await db.update(stationsTable).set(updates).where(eq(stationsTable.id, id)).returning();
  if (!row) return res.status(404).json({ error: "Station not found" });
  return res.json(row);
});

router.delete("/:id", async (req, res) => {
  const parsed = DeleteStationParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid id" });
  }
  await db.delete(stationsTable).where(eq(stationsTable.id, parsed.data.id));
  return res.status(204).send();
});

export default router;
