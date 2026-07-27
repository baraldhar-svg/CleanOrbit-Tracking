import { randomUUID } from "crypto";
import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import {
  usersTable,
  otpCodesTable,
  tenantsTable,
  stationsTable,
  passengersTable,
  driversTable,
  adminRegistrationsTable,
  insertAdminRegistrationSchema,
} from "@workspace/db";
import { eq, and, gt, isNotNull } from "drizzle-orm";
import { signToken, checkSuperAdminBypass } from "../lib/auth";
import { normalizePhone, syncUserAndProfiles } from "../lib/sync";
import { logger } from "../lib/logger";
import { broadcast } from "../lib/sse";

const router: Router = Router();

async function registerDriverSession(normalizedPhone: string, tenantId?: number | null): Promise<string> {
  const newSessionId = randomUUID();
  await db.update(driversTable).set({ activeSessionId: newSessionId }).where(eq(driversTable.phone, normalizedPhone));
  await db.update(usersTable).set({ activeSessionId: newSessionId }).where(eq(usersTable.phone, normalizedPhone));
  // Broadcast SSE event so old device gets immediately notified to logout & turn off GPS
  broadcast(tenantId ?? 1, "driver_session_invalidated", {
    phone: normalizedPhone,
    newSessionId,
  });
  return newSessionId;
}

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function slugifyToInitials(schoolName: string): string {
  const letters = schoolName
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join("");
  const base = letters.slice(0, 6) || "SCH";
  return base;
}

function randomSuffix(length = 4): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

async function generateUniqueSchoolCode(schoolName: string): Promise<string> {
  const prefix = slugifyToInitials(schoolName);
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = `${prefix}-${randomSuffix()}`;
    const [existing] = await db
      .select({ id: tenantsTable.id })
      .from(tenantsTable)
      .where(eq(tenantsTable.schoolCode, candidate))
      .limit(1);
    if (!existing) return candidate;
  }
  throw new Error("Failed to generate a unique school code");
}

// ⚠️ परिवर्तन गरिएको मुख्य ठाउँ: अब यसले ओटिपी नमागी सिधै लगिन गराइदिन्छ
router.post("/check-phone", async (req, res) => {
  try {
    const { phone } = req.body as { phone?: string };
    const raw = (phone ?? "").trim();
    if (!raw || !/^\+?\d{7,15}$/.test(raw.replace(/[\s\-()]/g, ""))) {
      return res.status(400).json({ error: "Enter a valid mobile number" });
    }
    const normalized = normalizePhone(raw);
    const cleanPhone = raw.replace(/[\s\-()]/g, "");

    if (cleanPhone === "9851049147" || cleanPhone.endsWith("9851049147") || normalized === "9851049147") {
      return res.json({
        found: true,
        requiresPassword: true,
        user: {
          id: 1,
          phone: "9851049147",
          name: "Super Admin",
          role: "superadmin",
          tenantId: null,
          schoolCode: null,
        },
      });
    }

    const { user } = await syncUserAndProfiles(normalized);

    if (!user) {
      return res.status(200).json({
        found: false,
        requiresRegistration: true,
        message: "This number is not registered yet. Proceed to registration.",
      });
    }

    let tenant = null;
    if (user.tenantId) {
      const [t] = await db
        .select()
        .from(tenantsTable)
        .where(eq(tenantsTable.id, user.tenantId))
        .limit(1);
      tenant = t ?? null;
    }

    return res.json({
      found: true,
      verified: true,
      user: { ...user, tenant },
      requiresSchoolCode: user.role !== "superadmin" && !!user.tenantId,
      token: signToken({ userId: user.id, role: user.role, tenantId: user.tenantId ?? null }),
    });
  } catch (err: any) {
    logger.error({ err }, "check-phone error");
    return res.status(500).json({
      error: err?.message || String(err),
      cause: err?.cause?.message || String(err?.cause || err),
    });
  }
});

router.post("/send-otp", async (req, res) => {
  const { phone } = req.body as { phone?: string };
  if (!phone || !/^9[6-9]\d{8}$/.test(phone.replace(/\s/g, ""))) {
    return res
      .status(400)
      .json({ error: "Enter a valid Nepal mobile number (98xxxxxxxx)" });
  }
  return res.json({ success: true, demoCode: "123456" });
});

router.post("/verify-otp", async (req, res) => {
  const { phone, schoolCode } = req.body as {
    phone?: string;
    schoolCode?: string;
  };
  if (!phone) return res.status(400).json({ error: "Phone required" });
  const normalized = normalizePhone(phone);

  const { user } = await syncUserAndProfiles(normalized);
  if (!user) return res.status(403).json({ error: "Access denied." });

  const sessionId = user.role === "driver" ? await registerDriverSession(normalized, user.tenantId) : undefined;

  let tenant = null;
  if (user.tenantId) {
    const [t] = await db
      .select()
      .from(tenantsTable)
      .where(eq(tenantsTable.id, user.tenantId))
      .limit(1);
    tenant = t ?? null;
  }
  return res.json({
    verified: true,
    user: { ...user, activeSessionId: sessionId ?? user.activeSessionId ?? null, tenant },
    token: signToken({ userId: user.id, role: user.role, tenantId: user.tenantId ?? null }),
    sessionId,
  });
});

router.post("/login-password", async (req, res) => {
  const { phone, password } = req.body as { phone?: string; password?: string };
  if (!phone || !password)
    return res.status(400).json({ error: "Phone and password are required" });
  
  const normalized = normalizePhone(phone);
  const cleanPhone = phone.replace(/[\s\-()]/g, "");

  if (cleanPhone === "9851049147" || cleanPhone.endsWith("9851049147") || normalized === "9851049147") {
    const bypass = await checkSuperAdminBypass(cleanPhone, password);
    if (bypass) {
      return res.json(bypass);
    } else {
      return res.status(401).json({ error: "Incorrect password" });
    }
  }

  const { user } = await syncUserAndProfiles(normalized);
  if (!user)
    return res.status(401).json({ error: "No account found for this number" });

  const valid = await bcrypt.compare(password, user.passwordHash || "");
  if (!valid) return res.status(401).json({ error: "Incorrect password" });

  const sessionId = user.role === "driver" ? await registerDriverSession(normalized, user.tenantId) : undefined;

  let tenant = null;
  if (user.tenantId) {
    const [t] = await db
      .select()
      .from(tenantsTable)
      .where(eq(tenantsTable.id, user.tenantId))
      .limit(1);
    tenant = t ?? null;
  }
  return res.json({
    verified: true,
    user: { ...user, activeSessionId: sessionId ?? user.activeSessionId ?? null, tenant },
    token: signToken({ userId: user.id, role: user.role, tenantId: user.tenantId ?? null }),
    sessionId,
  });
});

router.post("/logout", async (req, res) => {
  try {
    const { phone, userId } = req.body as { phone?: string; userId?: number };
    let targetPhone = phone ? normalizePhone(phone) : null;

    if (!targetPhone && userId) {
      const [u] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
      if (u?.phone) targetPhone = u.phone;
    }

    if (targetPhone) {
      await db.update(driversTable).set({ isOnline: false, activeSessionId: null }).where(eq(driversTable.phone, targetPhone));
      await db.update(usersTable).set({ activeSessionId: null }).where(eq(usersTable.phone, targetPhone));
    }
    return res.json({ success: true });
  } catch {
    return res.json({ success: true });
  }
});

router.post("/register", async (req, res) => {
  const {
    phone,
    name,
    title,
    role,
    gender,
    designation,
    schoolCode,
    photoUrl,
    password,
    className,
    customClass,
    section,
    rollNumber,
    faculty,
  } = req.body as {
    phone?: string;
    name?: string;
    title?: string;
    role?: string;
    gender?: string;
    designation?: string;
    schoolCode?: string;
    photoUrl?: string;
    password?: string;
    className?: string;
    customClass?: string;
    section?: string;
    rollNumber?: string;
    faculty?: string;
  };
  if (!phone || !name)
    return res.status(400).json({ error: "Phone and name are required" });
  const normalized = normalizePhone(phone);
  let tenantId: number | null = null;
  if (schoolCode) {
    const [tenant] = await db
      .select()
      .from(tenantsTable)
      .where(eq(tenantsTable.schoolCode, schoolCode))
      .limit(1);
    if (tenant) tenantId = tenant.id;
  }
  const passwordHash = password ? await bcrypt.hash(password, 10) : null;
  const [createdUser] = await db
    .insert(usersTable)
    .values({
      phone: normalized,
      name,
      title: designation || title || null,
      photoUrl: photoUrl ?? null,
      role: role ?? "student",
      schoolCode: schoolCode ?? null,
      tenantId,
      passwordHash,
    })
    .returning();

  // Sync to passenger/driver table!
  const { user } = await syncUserAndProfiles(normalized);
  const activeUser = user || createdUser;

  // Let's also check if they are student/staff and update additional fields if they provided them!
  if (activeUser && (activeUser.role === "student" || activeUser.role === "staff")) {
    const updates: Record<string, any> = {};
    if (className) updates.className = className;
    if (section) updates.section = section;
    if (rollNumber) updates.rollNumber = rollNumber;
    if (faculty) updates.faculty = faculty;
    if (designation) updates.designation = designation;
    if (gender) updates.gender = gender;
    if (Object.keys(updates).length > 0) {
      await db.update(passengersTable).set(updates).where(eq(passengersTable.phone, normalized));
    }
  }

  if (activeUser && activeUser.role === "driver" && gender) {
    await db.update(driversTable).set({ gender }).where(eq(driversTable.phone, normalized));
  }

  let tenant = null;
  if (activeUser.tenantId) {
    const [t] = await db
      .select()
      .from(tenantsTable)
      .where(eq(tenantsTable.id, activeUser.tenantId))
      .limit(1);
    tenant = t ?? null;
  }
  return res.status(201).json({ ...activeUser, tenant });
});

router.post("/register-school", async (req, res) => {
  const { phone, adminName, schoolName, address, contactPhone, bannerUrl } =
    req.body as {
      phone?: string;
      adminName?: string;
      schoolName?: string;
      address?: string;
      contactPhone?: string;
      bannerUrl?: string;
    };
  if (!phone || !adminName || !schoolName)
    return res.status(400).json({ error: "Missing required fields" });

  let tenant: typeof tenantsTable.$inferSelect | undefined;
  for (let insertAttempt = 0; insertAttempt < 5; insertAttempt++) {
    const schoolCode = await generateUniqueSchoolCode(schoolName);
    try {
      const [inserted] = await db
        .insert(tenantsTable)
        .values({
          name: schoolName,
          address: address ?? null,
          contactPhone: contactPhone ?? null,
          bannerUrl: bannerUrl ?? null,
          schoolCode,
        })
        .returning();
      tenant = inserted;
      break;
    } catch (err) {
      // Unique constraint race: another registration grabbed the same code
      // between our uniqueness check and insert. Retry with a fresh code.
      const message = err instanceof Error ? err.message : String(err);
      if (!message.includes("school_code")) throw err;
    }
  }
  if (!tenant)
    return res
      .status(500)
      .json({ error: "Could not generate a unique school code, please try again" });

  const [user] = await db
    .insert(usersTable)
    .values({
      phone,
      name: adminName,
      role: "admin",
      schoolCode: tenant.schoolCode,
      tenantId: tenant.id,
    })
    .returning();
  return res.status(201).json({ user, tenant, schoolCode: tenant.schoolCode });
});

router.post("/register-admin", async (req, res) => {
  const parsed = insertAdminRegistrationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid registration data",
      details: parsed.error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      })),
    });
  }
  const [reg] = await db
    .insert(adminRegistrationsTable)
    .values({ ...parsed.data })
    .returning();
  return res.status(201).json({ id: reg.id, status: reg.status });
});

router.post("/admin-send-otp", async (req, res) => {
  try {
    const { mobile, schoolCode } = req.body as { mobile?: string; schoolCode?: string };
    if (!mobile || !schoolCode) return res.status(400).json({ error: "Mobile number and school code required" });

    const code = schoolCode.trim().toUpperCase();

    const [reg] = await db
      .select()
      .from(adminRegistrationsTable)
      .where(eq(adminRegistrationsTable.schoolCode, code))
      .limit(1);

    const [tenant] = await db
      .select()
      .from(tenantsTable)
      .where(eq(tenantsTable.schoolCode, code))
      .limit(1);

    const schoolName = reg?.schoolName || tenant?.name || "School Admin";
    return res.json({
      success: true,
      demoCode: "123456",
      schoolName,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Failed to send OTP" });
  }
});

router.post("/admin-verify-otp", async (req, res) => {
  try {
    const { mobile, schoolCode, otpCode } = req.body as { mobile?: string; schoolCode?: string; otpCode?: string };
    if (!mobile || !schoolCode || !otpCode) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const normalized = normalizePhone(mobile);
    const code = schoolCode.trim().toUpperCase();

    // 1. Find school registration
    const [reg] = await db
      .select()
      .from(adminRegistrationsTable)
      .where(eq(adminRegistrationsTable.schoolCode, code))
      .limit(1);

    // 2. Find tenant by school code or reg.tenantId
    let tenant = null;
    if (reg?.tenantId) {
      const [t] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, reg.tenantId)).limit(1);
      tenant = t ?? null;
    }
    if (!tenant) {
      const [t] = await db.select().from(tenantsTable).where(eq(tenantsTable.schoolCode, code)).limit(1);
      tenant = t ?? null;
    }

    // 3. Find or create admin user in usersTable
    let [adminUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.phone, normalized))
      .limit(1);

    if (!adminUser) {
      const [created] = await db
        .insert(usersTable)
        .values({
          phone: normalized,
          name: reg?.adminName || "School Admin",
          role: "admin",
          schoolCode: code,
          tenantId: tenant?.id ?? null,
        })
        .returning();
      adminUser = created;
    } else {
      // Force role to 'admin', schoolCode to code, and tenantId to tenant.id!
      const [updated] = await db
        .update(usersTable)
        .set({
          role: "admin",
          schoolCode: code,
          tenantId: tenant?.id ?? adminUser.tenantId,
        })
        .where(eq(usersTable.id, adminUser.id))
        .returning();
      adminUser = updated;
    }

    // Mark registration status as verified_active
    if (reg) {
      await db
        .update(adminRegistrationsTable)
        .set({ status: "verified_active" })
        .where(eq(adminRegistrationsTable.id, reg.id));
    }

    const token = signToken({ userId: adminUser.id, role: "admin", tenantId: adminUser.tenantId ?? null });

    return res.json({
      verified: true,
      user: {
        ...adminUser,
        role: "admin",
        tenant,
      },
      token,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Verification failed" });
  }
});

router.patch("/profile", async (req, res) => {
  const { userId, name, title, photoUrl } = req.body as {
    userId?: number;
    name?: string;
    title?: string;
    photoUrl?: string | null;
  };
  const [updated] = await db
    .update(usersTable)
    .set({ name, title, photoUrl })
    .where(eq(usersTable.id, userId || 0))
    .returning();
  if (updated && updated.phone) {
    await syncUserAndProfiles(updated.phone);
  }
  return res.json(updated);
});

router.get("/me", async (req, res) => {
  const { phone } = req.query as { phone?: string };
  const normalized = normalizePhone(phone || "");
  const { user } = await syncUserAndProfiles(normalized);
  if (!user) return res.status(404).json({ error: "User not found" });

  let tenant = null;
  if (user.tenantId) {
    const [t] = await db
      .select()
      .from(tenantsTable)
      .where(eq(tenantsTable.id, user.tenantId))
      .limit(1);
    tenant = t ?? null;
  }
  return res.json({ ...user, tenant });
});

export default router;
