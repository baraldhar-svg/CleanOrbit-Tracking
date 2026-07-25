import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { tenantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: Router = Router();

router.get("/", async (_req, res) => {
  const tenants = await db.select().from(tenantsTable);
  res.json(tenants.map((t) => ({
    ...t,
    vehicleCount: 3,
    passengerCount: 12,
    subscriptionTier: t.subscriptionTier,
    monthlyRevenue: 15000,
  })));
});

router.get("/me", async (_req, res) => {
  const tenants = await db.select().from(tenantsTable).limit(1);
  if (!tenants.length) return res.status(404).json({ error: "No tenant found" });
  return res.json(tenants[0]);
});

router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, id)).limit(1);
  if (!tenant) return res.status(404).json({ error: "Not found" });
  return res.json(tenant);
});

router.patch("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const body = req.body as Record<string, unknown>;
  const updates: Partial<typeof tenantsTable.$inferInsert> = {};
  if (typeof body.name === "string") updates.name = body.name;
  if (typeof body.address === "string" || body.address === null) updates.address = body.address as string | null;
  if (typeof body.contactPhone === "string" || body.contactPhone === null) updates.contactPhone = body.contactPhone as string | null;
  if (typeof body.logoUrl === "string" || body.logoUrl === null) updates.logoUrl = body.logoUrl as string | null;
  if (typeof body.bannerUrl === "string" || body.bannerUrl === null) updates.bannerUrl = body.bannerUrl as string | null;
  if (typeof body.email === "string" || body.email === null) updates.email = body.email as string | null;
  if (typeof body.websiteUrl === "string" || body.websiteUrl === null) updates.websiteUrl = body.websiteUrl as string | null;
  if (typeof body.facebookUrl === "string" || body.facebookUrl === null) updates.facebookUrl = body.facebookUrl as string | null;
  if (typeof body.tiktokUrl === "string" || body.tiktokUrl === null) updates.tiktokUrl = body.tiktokUrl as string | null;
  if (typeof body.instagramUrl === "string" || body.instagramUrl === null) updates.instagramUrl = body.instagramUrl as string | null;
  if (typeof body.youtubeUrl === "string" || body.youtubeUrl === null) updates.youtubeUrl = body.youtubeUrl as string | null;
  if (typeof body.subscriptionTier === "string" && ["silver", "gold", "platinum"].includes(body.subscriptionTier)) {
    updates.subscriptionTier = body.subscriptionTier;
  }
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: "Nothing to update" });
  await db.update(tenantsTable).set(updates).where(eq(tenantsTable.id, id));
  const [row] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, id));
  return res.json(row);
});

export default router;
