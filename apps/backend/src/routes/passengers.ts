import { Router, type IRouter } from "express";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { db } from "@workspace/db";
import { passengersTable, stationsTable, usersTable, tenantsTable, boardingLogsTable, driversTable, driverNotificationsTable } from "@workspace/db";
import { eq, desc, and, or, ne, isNull, isNotNull } from "drizzle-orm";
import { broadcast } from "../lib/sse";
import { normalizePhone, syncUserAndProfiles } from "../lib/sync";
import { createNotification } from "../lib/notifications";
import {
  CreatePassengerBody,
  GetPassengerParams,
  UpdatePassengerParams,
  UpdatePassengerBody,
  BoardPassengerParams,
  MarkPassengerLeaveParams,
} from "@workspace/api-zod";

// Use a configured secret, or generate a random one per process start (dev/demo only).
// QR codes issued under a random secret become invalid on server restart — acceptable for
// the 12-hour session-scoped use case. In production, set QR_TOKEN_SECRET to a stable value.
const QR_SECRET = process.env["QR_TOKEN_SECRET"] ?? randomBytes(32).toString("hex");
const QR_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function signQrPayload(passengerId: number, tenantId: number, ts: number): string {
  const payload = `${passengerId}:${tenantId}:${ts}`;
  return createHmac("sha256", QR_SECRET).update(payload).digest("hex");
}

function makeQrToken(passengerId: number, tenantId: number): string {
  const ts = Date.now();
  const sig = signQrPayload(passengerId, tenantId, ts);
  const data = JSON.stringify({ pid: passengerId, tid: tenantId, ts, sig });
  return Buffer.from(data).toString("base64url");
}

function verifyQrToken(token: string, expectedPassengerId: number, expectedTenantId: number): boolean {
  try {
    const data = JSON.parse(Buffer.from(token, "base64url").toString("utf8")) as {
      pid: number; tid: number; ts: number; sig: string;
    };
    if (data.pid !== expectedPassengerId || data.tid !== expectedTenantId) return false;
    if (Date.now() - data.ts > QR_TTL_MS) return false;
    const expectedSig = signQrPayload(data.pid, data.tid, data.ts);
    const sigBuf = Buffer.from(data.sig, "hex");
    const expectedBuf = Buffer.from(expectedSig, "hex");
    if (sigBuf.length !== expectedBuf.length) return false;
    return timingSafeEqual(sigBuf, expectedBuf);
  } catch {
    return false;
  }
}

const router: Router = Router();

// In-memory boarding OTP store: passengerId → { code, expiresAt }
// OTPs expire after 5 minutes. In production, the code would be sent via SMS.
const boardingOtps = new Map<number, { code: string; expiresAt: Date }>();

function generateBoardingOtp(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}
const PASSENGER_SELECT = {
  id: passengersTable.id,
  name: passengersTable.name,
  phone: passengersTable.phone,
  photoUrl: passengersTable.photoUrl,
  role: passengersTable.role,
  status: passengersTable.status,
  stationId: passengersTable.stationId,
  routeId: passengersTable.routeId,
  stationName: stationsTable.name,
  boardedAt: passengersTable.boardedAt,
  tenantId: passengersTable.tenantId,
  liveToday: passengersTable.liveToday,
  quickMessage: passengersTable.quickMessage,
  routeSubscribedAt: passengersTable.routeSubscribedAt,
  className: passengersTable.className,
  section: passengersTable.section,
  rollNumber: passengersTable.rollNumber,
  faculty: passengersTable.faculty,
  designation: passengersTable.designation,
  parentName: passengersTable.parentName,
  gender: passengersTable.gender,
  liveDate: passengersTable.liveDate,
};

const SUBSCRIPTION_DAYS = 30;
const EXPIRY_WARN_DAYS = 5;

function computeSubStatus(row: { routeId: number | null; routeSubscribedAt: Date | null }) {
  const hasRoute = row.routeId != null;
  if (!hasRoute || !row.routeSubscribedAt) {
    return { isPaying: false, isExpired: false, daysLeft: null, showExpiryBanner: false };
  }
  const daysElapsed = Math.floor((Date.now() - new Date(row.routeSubscribedAt).getTime()) / 86400000);
  const isExpired = daysElapsed >= SUBSCRIPTION_DAYS;
  const isPaying = !isExpired;
  const daysLeft = Math.max(0, SUBSCRIPTION_DAYS - daysElapsed);
  const showExpiryBanner = isPaying && daysLeft <= EXPIRY_WARN_DAYS;
  return { isPaying, isExpired, daysLeft, showExpiryBanner };
}

// Returns today's date as YYYY-MM-DD in Nepal Standard Time (UTC+5:45)
function todayNST(): string {
  const now = new Date(Date.now() + 5 * 60 * 60 * 1000 + 45 * 60 * 1000);
  return now.toISOString().slice(0, 10);
}

router.get("/", async (req, res) => {
  const { phone } = req.query as { phone?: string };
  const baseWhere = eq(passengersTable.tenantId, req.tenantId);
  const whereClause = phone
    ? and(baseWhere, eq(passengersTable.phone, normalizePhone(phone)))
    : baseWhere;

  // Lazy daily reset — wipe liveToday/status/boardedAt for any passenger whose live_date is stale
  const today = todayNST();
  await db.update(passengersTable)
    .set({ liveToday: 0, status: "pending", boardedAt: null, quickMessage: null, liveDate: today })
    .where(
      and(
        baseWhere,
        or(isNull(passengersTable.liveDate), ne(passengersTable.liveDate, today)),
        or(
          ne(passengersTable.liveToday, 0),
          ne(passengersTable.status, "pending"),
          isNotNull(passengersTable.boardedAt),
        )
      )
    );

  const rows = await db
    .select(PASSENGER_SELECT)
    .from(passengersTable)
    .leftJoin(stationsTable, eq(passengersTable.stationId, stationsTable.id))
    .where(whereClause);
  const enriched = rows.map((r) => ({ ...r, ...computeSubStatus(r) }));
  return res.json(enriched);
});

// GET /passengers/boarding-logs — real-time boarding audit log for admin
router.get("/boarding-logs", async (req, res) => {
  const limit = Math.min(Number(req.query["limit"] ?? 100), 200);
  const rows = await db
    .select()
    .from(boardingLogsTable)
    .where(eq(boardingLogsTable.tenantId, req.tenantId))
    .orderBy(desc(boardingLogsTable.actionAt))
    .limit(limit);
  return res.json(rows);
});

// GET /passengers/communications — merged communications log for admin
// (boarding events + driver notifications + student messages)
router.get("/communications", async (req, res) => {
  const limit = Math.min(Number(req.query["limit"] ?? 100), 200);

  const [boardingLogs, driverNotifs, studentMsgs] = await Promise.all([
    db.select().from(boardingLogsTable)
      .where(eq(boardingLogsTable.tenantId, req.tenantId))
      .orderBy(desc(boardingLogsTable.actionAt))
      .limit(limit),
    db.select().from(driverNotificationsTable)
      .where(eq(driverNotificationsTable.tenantId, req.tenantId))
      .orderBy(desc(driverNotificationsTable.sentAt))
      .limit(limit),
    db.select({
      id: passengersTable.id,
      name: passengersTable.name,
      stationName: stationsTable.name,
      quickMessage: passengersTable.quickMessage,
    })
      .from(passengersTable)
      .leftJoin(stationsTable, eq(passengersTable.stationId, stationsTable.id))
      .where(and(
        eq(passengersTable.tenantId, req.tenantId),
        isNotNull(passengersTable.quickMessage),
      )),
  ]);

  const merged = [
    ...boardingLogs.map((l) => ({
      id: `boarding-${l.id}`,
      type: "boarding" as const,
      passengerName: l.passengerName,
      stationName: l.stationName,
      content: l.action,
      timestamp: l.actionAt,
      driverName: l.driverName,
    })),
    ...driverNotifs.map((n) => ({
      id: `notify-${n.id}`,
      type: "driver_notification" as const,
      passengerName: n.passengerName,
      stationName: n.stationName,
      content: n.message,
      timestamp: n.sentAt,
      driverName: n.driverName,
    })),
    ...studentMsgs.filter((p) => p.quickMessage).map((p) => ({
      id: `msg-${p.id}`,
      type: "student_message" as const,
      passengerName: p.name,
      stationName: p.stationName ?? null,
      content: p.quickMessage!,
      timestamp: null as Date | null,
      driverName: null as string | null,
    })),
  ].sort((a, b) => {
    if (!a.timestamp && !b.timestamp) return 0;
    if (!a.timestamp) return 1;
    if (!b.timestamp) return -1;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  }).slice(0, limit);

  return res.json(merged);
});

router.post("/", async (req, res) => {
  try {
    const parsed = CreatePassengerBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.message });
    }
    const { name, phone, photoUrl, role, stationId, routeId, className, section, rollNumber, faculty, designation } = parsed.data;
    
    const normalizedPhone = phone ? normalizePhone(phone) : null;

    if (normalizedPhone) {
      const [existing] = await db
        .select()
        .from(passengersTable)
        .where(and(eq(passengersTable.phone, normalizedPhone), eq(passengersTable.tenantId, req.tenantId)))
        .limit(1);
      if (existing) {
        return res.status(409).json({ error: "A passenger with this phone number already exists." });
      }
    }

    let targetStationId = stationId;
    if (!targetStationId) {
      const [station] = await db.select().from(stationsTable).where(eq(stationsTable.tenantId, req.tenantId)).limit(1);
      if (station) {
        targetStationId = station.id;
      } else {
        const [newStation] = await db.insert(stationsTable).values({
          tenantId: req.tenantId,
          name: "Default Station",
          lat: 27.7172,
          lng: 85.3240,
          radius: 200
        }).returning();
        targetStationId = newStation.id;
      }
    }

    const [row] = await db
      .insert(passengersTable)
      .values({
        tenantId: req.tenantId,
        name,
        phone: normalizedPhone,
        photoUrl: photoUrl ?? null,
        role: role ?? "student",
        stationId: targetStationId,
        routeId: routeId ?? null,
        status: "pending",
        className: className ?? null,
        section: section ?? null,
        rollNumber: rollNumber ?? null,
        faculty: faculty ?? null,
        designation: designation ?? null,
      })
      .returning();

    if (normalizedPhone) {
      await syncUserAndProfiles(normalizedPhone);
    }

    const [withStation] = await db
      .select(PASSENGER_SELECT)
      .from(passengersTable)
      .leftJoin(stationsTable, eq(passengersTable.stationId, stationsTable.id))
      .where(eq(passengersTable.id, row.id));
    if (!withStation) {
      console.error("Passenger not found after insert! ID:", row.id);
      return res.status(404).json({ error: "Passenger not found after creation" });
    }
    const result = { ...withStation, ...computeSubStatus(withStation) };
    return res.status(201).json(result);
  } catch (e: any) {
    console.error("POST /passengers failed:", e);
    return res.status(500).json({ error: e.message || "Failed to create passenger" });
  }
});

router.get("/:id", async (req, res) => {
  const parsed = GetPassengerParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) return res.status(400).json({ error: "Invalid id" });
  const [row] = await db
    .select(PASSENGER_SELECT)
    .from(passengersTable)
    .leftJoin(stationsTable, eq(passengersTable.stationId, stationsTable.id))
    .where(eq(passengersTable.id, parsed.data.id));
  if (!row) return res.status(404).json({ error: "Not found" });
  return res.json({ ...row, ...computeSubStatus(row) });
});

router.patch("/:id", async (req, res) => {
  const paramsParsed = UpdatePassengerParams.safeParse({ id: Number(req.params.id) });
  if (!paramsParsed.success) return res.status(400).json({ error: "Invalid id" });
  const bodyParsed = UpdatePassengerBody.safeParse(req.body);
  if (!bodyParsed.success) return res.status(400).json({ error: bodyParsed.error.message });
  const updates: Record<string, unknown> = {};
  if (bodyParsed.data.name) updates.name = bodyParsed.data.name;
  if ("phone" in bodyParsed.data) updates.phone = bodyParsed.data.phone ? normalizePhone(bodyParsed.data.phone) : null;
  if (bodyParsed.data.photoUrl) updates.photoUrl = bodyParsed.data.photoUrl;
  if (bodyParsed.data.stationId) updates.stationId = bodyParsed.data.stationId;
  if ("routeId" in bodyParsed.data) {
    updates.routeId = bodyParsed.data.routeId;
    // Stamp routeSubscribedAt when a route is first assigned
    if (bodyParsed.data.routeId != null) {
      const [existing] = await db
        .select({ routeSubscribedAt: passengersTable.routeSubscribedAt })
        .from(passengersTable)
        .where(eq(passengersTable.id, paramsParsed.data.id))
        .limit(1);
      if (!existing?.routeSubscribedAt) {
        updates.routeSubscribedAt = new Date();
      }
    }
  }
  if (bodyParsed.data.liveToday !== undefined) {
    updates.liveToday = bodyParsed.data.liveToday;
    if (bodyParsed.data.liveToday === 1) updates.liveDate = todayNST();
  }
  if (bodyParsed.data.quickMessage !== undefined) updates.quickMessage = bodyParsed.data.quickMessage;
  if ("className" in bodyParsed.data) updates.className = bodyParsed.data.className;
  if ("section" in bodyParsed.data) updates.section = bodyParsed.data.section;
  if ("rollNumber" in bodyParsed.data) updates.rollNumber = bodyParsed.data.rollNumber;
  if ("faculty" in bodyParsed.data) updates.faculty = bodyParsed.data.faculty;
  if ("designation" in bodyParsed.data) updates.designation = bodyParsed.data.designation;
  if ("parentName" in bodyParsed.data) updates.parentName = bodyParsed.data.parentName;
  if ("gender" in bodyParsed.data) updates.gender = bodyParsed.data.gender;
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "No fields to update" });
  }
  await db.update(passengersTable).set(updates).where(eq(passengersTable.id, paramsParsed.data.id));

  // Get updated phone/original phone to sync
  const [passengerRow] = await db
    .select({ phone: passengersTable.phone })
    .from(passengersTable)
    .where(eq(passengersTable.id, paramsParsed.data.id))
    .limit(1);
  if (passengerRow && passengerRow.phone) {
    await syncUserAndProfiles(passengerRow.phone);
  }

  const [row] = await db
    .select(PASSENGER_SELECT)
    .from(passengersTable)
    .leftJoin(stationsTable, eq(passengersTable.stationId, stationsTable.id))
    .where(eq(passengersTable.id, paramsParsed.data.id));
  return res.json({ ...row, ...computeSubStatus(row) });
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!id || isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  await db.delete(passengersTable).where(eq(passengersTable.id, id));
  return res.status(204).end();
});

// POST /api/passengers/:id/renew — reset subscription window to now (manual renewal / payment success)
router.post("/:id/renew", async (req, res) => {
  const id = Number(req.params.id);
  if (!id || isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const renewedAt = new Date();
  await db.update(passengersTable)
    .set({ routeSubscribedAt: renewedAt })
    .where(eq(passengersTable.id, id));
  return res.json({ ok: true, renewedAt: renewedAt.toISOString() });
});

router.get("/:id/qr-token", async (req, res) => {
  const id = Number(req.params.id);
  if (!id || isNaN(id)) return res.status(400).json({ error: "Invalid passenger id" });
  const [passenger] = await db
    .select({ id: passengersTable.id, tenantId: passengersTable.tenantId })
    .from(passengersTable)
    .where(and(eq(passengersTable.id, id), eq(passengersTable.tenantId, req.tenantId)))
    .limit(1);
  if (!passenger) return res.status(404).json({ error: "Passenger not found" });
  const token = makeQrToken(passenger.id, passenger.tenantId);
  return res.json({ token });
});

router.post("/:id/send-boarding-otp", async (req, res) => {
  const id = Number(req.params.id);
  if (!id || isNaN(id)) return res.status(400).json({ error: "Invalid passenger id" });
  const code = generateBoardingOtp();
  boardingOtps.set(id, { code, expiresAt: new Date(Date.now() + 5 * 60_000) });
  // In production, send code via SMS to the parent's phone number.
  // In demo/simulation mode, we return the code so the driver can relay it.
  req.log.info({ passengerId: id }, "boarding OTP generated");
  return res.json({ success: true, demoCode: code });
});

router.post("/:id/board", async (req, res) => {
  const parsed = BoardPassengerParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) return res.status(400).json({ error: "Invalid id" });

  const { otp, qrToken } = req.body as { otp?: string; qrToken?: string };
  if (!otp && !qrToken) return res.status(400).json({ error: "OTP or QR token is required" });

  if (qrToken) {
    const valid = verifyQrToken(qrToken, parsed.data.id, req.tenantId);
    if (!valid) return res.status(401).json({ error: "Invalid or expired QR token. Have the parent refresh their QR code." });
  } else {
    const stored = boardingOtps.get(parsed.data.id);
    if (!stored) return res.status(401).json({ error: "No OTP found for this passenger. Please send a new OTP." });
    if (new Date() > stored.expiresAt) {
      boardingOtps.delete(parsed.data.id);
      return res.status(401).json({ error: "OTP has expired. Please send a new one." });
    }
    if (stored.code !== otp!.trim()) {
      return res.status(401).json({ error: "Incorrect OTP. Please try again." });
    }
    boardingOtps.delete(parsed.data.id);
  }

  await db
    .update(passengersTable)
    .set({ status: "boarded", boardedAt: new Date() })
    .where(eq(passengersTable.id, parsed.data.id));
  const [row] = await db
    .select(PASSENGER_SELECT)
    .from(passengersTable)
    .leftJoin(stationsTable, eq(passengersTable.stationId, stationsTable.id))
    .where(eq(passengersTable.id, parsed.data.id));
  // Write boarding audit log
  if (row) {
    const [activeDriver] = await db.select().from(driversTable)
      .where(eq(driversTable.tenantId, req.tenantId)).limit(1);
    await db.insert(boardingLogsTable).values({
      tenantId: req.tenantId,
      passengerId: row.id,
      passengerName: row.name,
      stationId: row.stationId ?? 0,
      stationName: row.stationName ?? "Unknown",
      driverId: activeDriver?.id ?? null,
      driverName: activeDriver?.name ?? null,
      action: "boarded",
    });
  }
  broadcast(req.tenantId, "passengers_updated", { tenantId: req.tenantId, passengerId: parsed.data.id, action: "boarded" });
  return res.json({ ...row, ...computeSubStatus(row ?? { routeId: null, routeSubscribedAt: null }) });
});

router.post("/:id/absent", async (req, res) => {
  const parsed = BoardPassengerParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) return res.status(400).json({ error: "Invalid id" });
  await db
    .update(passengersTable)
    .set({ status: "absent", boardedAt: null })
    .where(eq(passengersTable.id, parsed.data.id));
  const [row] = await db
    .select(PASSENGER_SELECT)
    .from(passengersTable)
    .leftJoin(stationsTable, eq(passengersTable.stationId, stationsTable.id))
    .where(eq(passengersTable.id, parsed.data.id));
  // Write absent audit log
  if (row) {
    const [activeDriver] = await db.select().from(driversTable)
      .where(eq(driversTable.tenantId, req.tenantId)).limit(1);
    await db.insert(boardingLogsTable).values({
      tenantId: req.tenantId,
      passengerId: row.id,
      passengerName: row.name,
      stationId: row.stationId ?? 0,
      stationName: row.stationName ?? "Unknown",
      driverId: activeDriver?.id ?? null,
      driverName: activeDriver?.name ?? null,
      action: "absent",
    });

    // Create in-app notification — real-time push to admin portal + parent app
    void createNotification({
      tenantId: req.tenantId,
      passengerId: row.id,
      type: "absent",
      title: `${row.name} marked absent`,
      body: `${row.name} was marked absent at ${row.stationName ?? "their stop"} by the driver. Please arrange alternative transport if needed.`,
    });
  }
  broadcast(req.tenantId, "passengers_updated", { tenantId: req.tenantId, passengerId: parsed.data.id, action: "absent" });
  return res.json({ ...row, ...computeSubStatus(row ?? { routeId: null, routeSubscribedAt: null }) });
});

router.post("/:id/unboard", async (req, res) => {
  const parsed = BoardPassengerParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) return res.status(400).json({ error: "Invalid id" });
  await db
    .update(passengersTable)
    .set({ status: "pending", boardedAt: null })
    .where(eq(passengersTable.id, parsed.data.id));
  const [row] = await db
    .select(PASSENGER_SELECT)
    .from(passengersTable)
    .leftJoin(stationsTable, eq(passengersTable.stationId, stationsTable.id))
    .where(eq(passengersTable.id, parsed.data.id));
  broadcast(req.tenantId, "passengers_updated", { tenantId: req.tenantId, passengerId: parsed.data.id, action: "unboarded" });
  return res.json({ ...row, ...computeSubStatus(row ?? { routeId: null, routeSubscribedAt: null }) });
});

router.post("/:id/leave", async (req, res) => {
  const parsed = MarkPassengerLeaveParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) return res.status(400).json({ error: "Invalid id" });
  await db
    .update(passengersTable)
    .set({ status: "leave", boardedAt: null })
    .where(eq(passengersTable.id, parsed.data.id));
  const [row] = await db
    .select(PASSENGER_SELECT)
    .from(passengersTable)
    .leftJoin(stationsTable, eq(passengersTable.stationId, stationsTable.id))
    .where(eq(passengersTable.id, parsed.data.id));
  broadcast(req.tenantId, "passengers_updated", { tenantId: req.tenantId, passengerId: parsed.data.id, action: "leave" });
  return res.json({ ...row, ...computeSubStatus(row ?? { routeId: null, routeSubscribedAt: null }) });
});

// POST /api/passengers/:id/driver-notify — driver sends "waiting" ping to a student
// Deduplicated: one notification per passenger per station per calendar day
router.post("/:id/driver-notify", async (req, res) => {
  const id = Number(req.params.id);
  if (!id || isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const [passenger] = await db
    .select(PASSENGER_SELECT)
    .from(passengersTable)
    .leftJoin(stationsTable, eq(passengersTable.stationId, stationsTable.id))
    .where(eq(passengersTable.id, id));
  if (!passenger) return res.status(404).json({ error: "Not found" });

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const [existing] = await db
    .select()
    .from(driverNotificationsTable)
    .where(and(
      eq(driverNotificationsTable.passengerId, id),
      eq(driverNotificationsTable.stationId, passenger.stationId ?? 0),
      eq(driverNotificationsTable.tripDate, today),
    ))
    .limit(1);

  if (existing) {
    return res.json({ ok: false, alreadySent: true, sentAt: existing.sentAt });
  }

  const [activeDriver] = await db
    .select()
    .from(driversTable)
    .where(eq(driversTable.tenantId, req.tenantId))
    .limit(1);

  const [notification] = await db
    .insert(driverNotificationsTable)
    .values({
      tenantId: req.tenantId,
      passengerId: id,
      passengerName: passenger.name,
      stationId: passenger.stationId ?? 0,
      stationName: passenger.stationName ?? "Unknown",
      driverId: activeDriver?.id ?? null,
      driverName: activeDriver?.name ?? null,
      message: "Driver is waiting for you. Please come to the station.",
      tripDate: today,
    })
    .returning();

  broadcast(req.tenantId, "driver_notification", { tenantId: req.tenantId, passengerId: id, message: notification.message });
  return res.json({ ok: true, alreadySent: false, notification });
});

export default router;
