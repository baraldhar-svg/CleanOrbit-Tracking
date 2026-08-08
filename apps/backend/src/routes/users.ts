import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable, tenantsTable, otpCodesTable } from "@workspace/db";
import { eq, and, asc, desc, gt } from "drizzle-orm";
import { sendOtpSms } from "../utils/sms";

const router: Router = Router();

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

router.get("/", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const role = typeof req.query.role === "string" ? req.query.role.trim() : "";

  let rows = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      phone: usersTable.phone,
      role: usersTable.role,
      tenantId: usersTable.tenantId,
      tenantName: tenantsTable.name,
      createdAt: usersTable.createdAt,
      biometricEnabled: usersTable.biometricEnabled,
      isManuallyActivated: usersTable.isManuallyActivated,
    })
    .from(usersTable)
    .leftJoin(tenantsTable, eq(usersTable.tenantId, tenantsTable.id))
    .where(eq(usersTable.tenantId, req.tenantId)) // FIX: Filter by tenant
    .orderBy(usersTable.tenantId, usersTable.name);

  if (q) {
    const lower = q.toLowerCase();
    rows = rows.filter(
      (r) =>
        r.name.toLowerCase().includes(lower) ||
        r.phone.includes(lower)
    );
  }
  if (role) {
    rows = rows.filter((r) => r.role === role);
  }

  return res.json(rows);
});

router.patch("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const body = req.body as Record<string, unknown>;
  const updates: Partial<typeof usersTable.$inferInsert> = {};

  if (typeof body.name === "string" && body.name.trim()) updates.name = body.name.trim();
  if (typeof body.phone === "string" && body.phone.trim()) updates.phone = body.phone.trim();
  if (
    typeof body.role === "string" &&
    ["student", "driver", "admin", "superadmin"].includes(body.role)
  ) {
    updates.role = body.role as typeof usersTable.$inferInsert["role"];
  }

  if (Object.keys(updates).length === 0)
    return res.status(400).json({ error: "Nothing to update" });

  await db.update(usersTable)
    .set(updates)
    .where(and(eq(usersTable.id, id), eq(usersTable.tenantId, req.tenantId)));

  const [row] = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      phone: usersTable.phone,
      role: usersTable.role,
      tenantId: usersTable.tenantId,
      tenantName: tenantsTable.name,
      createdAt: usersTable.createdAt,
      biometricEnabled: usersTable.biometricEnabled,
      isManuallyActivated: usersTable.isManuallyActivated,
    })
    .from(usersTable)
    .leftJoin(tenantsTable, eq(usersTable.tenantId, tenantsTable.id))
    .where(eq(usersTable.id, id));

  return res.json(row);
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  await db.delete(usersTable).where(and(eq(usersTable.id, id), eq(usersTable.tenantId, req.tenantId)));
  return res.json({ ok: true });
});

// Feature: Add Admin Modal
router.post("/add-admin-request", async (req, res) => {
  if (!req.tenantId) return res.status(401).json({ error: "Unauthorized" });
  
  const { phone, name, designation, email, title } = req.body;
  if (!phone || !name) {
    return res.status(400).json({ error: "Phone and Name are required" });
  }

  // Find the oldest admin in the tenant
  const [primaryAdmin] = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.tenantId, req.tenantId), eq(usersTable.role, "admin")))
    .orderBy(asc(usersTable.id))
    .limit(1);

  if (!primaryAdmin) {
    return res.status(400).json({ error: "No primary admin found in the system to authorize this request." });
  }

  const otp = generateOtp();
  await db.insert(otpCodesTable).values({
    phone: primaryAdmin.phone,
    code: otp,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 mins
  });

  await sendOtpSms(primaryAdmin.phone, otp);

  // Mask the phone number for the frontend to show
  const maskedPhone = primaryAdmin.phone.substring(0, 3) + "****" + primaryAdmin.phone.substring(primaryAdmin.phone.length - 3);

  return res.json({ ok: true, targetPhone: maskedPhone });
});

router.post("/add-admin-verify", async (req, res) => {
  if (!req.tenantId) return res.status(401).json({ error: "Unauthorized" });

  const { otpCode, phone, name, designation, email, title } = req.body;
  if (!otpCode || !phone || !name) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const [primaryAdmin] = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.tenantId, req.tenantId), eq(usersTable.role, "admin")))
    .orderBy(asc(usersTable.id))
    .limit(1);

  if (!primaryAdmin) {
    return res.status(400).json({ error: "Primary admin not found" });
  }

  // Verify OTP against primary admin's phone
  const [validOtp] = await db
    .select()
    .from(otpCodesTable)
    .where(
      and(
        eq(otpCodesTable.phone, primaryAdmin.phone),
        eq(otpCodesTable.used, 0),
        gt(otpCodesTable.expiresAt, new Date())
      )
    )
    .orderBy(desc(otpCodesTable.id))
    .limit(1);

  if (!validOtp || validOtp.code !== otpCode) {
    return res.status(400).json({ error: "Invalid or expired OTP" });
  }

  await db.update(otpCodesTable)
    .set({ used: 1 })
    .where(eq(otpCodesTable.id, validOtp.id));

  // Add the new admin
  const [newAdmin] = await db.insert(usersTable).values({
    phone,
    name,
    designation: designation || null,
    email: email || null,
    title: title || null,
    role: "admin",
    tenantId: req.tenantId,
  }).returning();

  return res.json({ ok: true, admin: newAdmin });
});

export default router;
