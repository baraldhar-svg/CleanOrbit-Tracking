import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import app from "../app";
import { db, usersTable } from "@workspace/db";

describe("POST /api/auth/check-phone", () => {
  const TEST_PHONE = `98${Date.now().toString().slice(-8)}`;
  let insertedUserId: number | undefined;

  beforeAll(async () => {
    const [user] = await db
      .insert(usersTable)
      .values({
        phone: TEST_PHONE,
        name: "Test Parent",
        role: "parent",
        tenantId: null,
        schoolCode: null,
      })
      .returning();
    insertedUserId = user?.id;
  });

  afterAll(async () => {
    if (insertedUserId) {
      await db.delete(usersTable).where(eq(usersTable.id, insertedUserId));
    }
  });

  it("returns 200 with found: true for a phone number that exists in the DB", async () => {
    const res = await request(app)
      .post("/api/auth/check-phone")
      .send({ phone: TEST_PHONE })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(200);
    expect(res.body.found).toBe(true);
    expect(res.body.user).toBeTruthy();
    expect(res.body.user.phone).toBe(TEST_PHONE);
  });

  it("returns 403 with found: false for a well-formed but unrecognized phone number", async () => {
    const res = await request(app)
      .post("/api/auth/check-phone")
      .send({ phone: "9799999999" })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(403);
    expect(res.body.found).toBe(false);
    expect(res.body).toHaveProperty("error");
  });

  it("returns 400 for a malformed phone string", async () => {
    const res = await request(app)
      .post("/api/auth/check-phone")
      .send({ phone: "not-a-phone" })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("returns 400 when the request body has no phone field", async () => {
    const res = await request(app)
      .post("/api/auth/check-phone")
      .send({})
      .set("Content-Type", "application/json");

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });
});
