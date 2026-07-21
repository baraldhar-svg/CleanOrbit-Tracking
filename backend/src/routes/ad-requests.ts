import { Router, type IRouter } from "express";
import { db, adRequestsTable, advertisementsTable } from "@workspace/db";
import { eq, desc, asc } from "drizzle-orm";
import { requireRole } from "../lib/auth";

const router: IRouter = Router();

// GET /api/ad-requests — superadmin: list all requests
router.get("/", requireRole("superadmin"), async (_req, res) => {
  const rows = await db
    .select()
    .from(adRequestsTable)
    .orderBy(desc(adRequestsTable.id));
  return res.json(rows);
});

// POST /api/ad-requests — public: submit an ad request
router.post("/", async (req, res) => {
  const {
    advertiserName, contactPerson, phone, email,
    adTitle, subtitle, imageUrl, targetUrl, daysRequested,
  } = req.body as {
    advertiserName?: string; contactPerson?: string; phone?: string; email?: string;
    adTitle?: string; subtitle?: string; imageUrl?: string; targetUrl?: string;
    daysRequested?: number;
  };

  if (!advertiserName || !phone || !adTitle || !imageUrl) {
    return res.status(400).json({ error: "advertiserName, phone, adTitle and imageUrl are required" });
  }

  const days = Math.max(1, Math.min(90, Number(daysRequested) || 1));
  const costNpr = days * 500;
  const now = new Date();
  const createdAt = now.toISOString().slice(0, 10);

  const [row] = await db.insert(adRequestsTable).values({
    advertiserName,
    contactPerson: contactPerson ?? null,
    phone,
    email: email ?? null,
    adTitle,
    subtitle: subtitle ?? null,
    imageUrl,
    targetUrl: targetUrl ?? null,
    daysRequested: days,
    costNpr,
    status: "pending",
    createdAt,
  }).returning();

  return res.status(201).json(row);
});

// POST /api/ad-requests/:id/approve — superadmin: approve + publish to carousel
router.post("/:id/approve", requireRole("superadmin"), async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const [request] = await db.select().from(adRequestsTable).where(eq(adRequestsTable.id, id));
  if (!request) return res.status(404).json({ error: "Request not found" });

  const now = new Date();
  const start = now.toISOString().slice(0, 10);
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + request.daysRequested);
  const end = endDate.toISOString().slice(0, 10);

  // Get max sortOrder
  const existing = await db.select().from(advertisementsTable).orderBy(desc(advertisementsTable.sortOrder));
  const maxSort = existing.length > 0 ? (existing[0].sortOrder ?? 0) : 0;

  // Publish to carousel
  await db.insert(advertisementsTable).values({
    title: request.adTitle,
    subtitle: request.subtitle ?? null,
    imageUrl: request.imageUrl,
    targetUrl: request.targetUrl ?? null,
    tenantId: null,
    sortOrder: maxSort + 1,
    active: 1,
  });

  // Mark request approved
  await db.update(adRequestsTable)
    .set({ status: "approved", startDate: start, endDate: end })
    .where(eq(adRequestsTable.id, id));

  const [updated] = await db.select().from(adRequestsTable).where(eq(adRequestsTable.id, id));
  return res.json(updated);
});

// POST /api/ad-requests/:id/reject — superadmin: reject with reason
router.post("/:id/reject", requireRole("superadmin"), async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const { reason } = req.body as { reason?: string };

  await db.update(adRequestsTable)
    .set({ status: "rejected", rejectionReason: reason ?? null })
    .where(eq(adRequestsTable.id, id));

  const [updated] = await db.select().from(adRequestsTable).where(eq(adRequestsTable.id, id));
  return res.json(updated);
});

export default router;
