import { db } from "@workspace/db";
import { usersTable, passengersTable, driversTable, tenantsTable, stationsTable } from "@workspace/db";
import { eq, and, isNotNull } from "drizzle-orm";

export function normalizePhone(raw: string): string {
  const stripped = raw.replace(/[\s\-()]/g, "");
  if (stripped.startsWith("+977")) return stripped.slice(4);
  if (stripped.startsWith("977") && stripped.length > 10)
    return stripped.slice(3);
  return stripped;
}

export async function syncUserAndProfiles(normalizedPhone: string) {
  if (!normalizedPhone) return { user: null, passenger: null, driver: null };

  // 1. Fetch user
  let [user] = await db.select().from(usersTable).where(eq(usersTable.phone, normalizedPhone)).limit(1);

  // 2. Fetch passenger (if student or staff)
  let [passenger] = await db
    .select()
    .from(passengersTable)
    .where(and(eq(passengersTable.phone, normalizedPhone), isNotNull(passengersTable.phone)))
    .limit(1);

  // 3. Fetch driver
  let [driver] = await db
    .select()
    .from(driversTable)
    .where(eq(driversTable.phone, normalizedPhone))
    .limit(1);

  // Case A: Passenger exists, but User does not
  if (passenger && !user) {
    let schoolCode: string | null = null;
    if (passenger.tenantId) {
      const [t] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, passenger.tenantId)).limit(1);
      schoolCode = t?.schoolCode ?? null;
    }
    const [created] = await db
      .insert(usersTable)
      .values({
        phone: normalizedPhone,
        name: passenger.name,
        role: passenger.role || "student",
        tenantId: passenger.tenantId,
        schoolCode,
        photoUrl: passenger.photoUrl,
      })
      .returning();
    user = created;
  }

  // Case B: Driver exists, but User does not
  if (driver && !user) {
    let schoolCode: string | null = null;
    if (driver.tenantId) {
      const [t] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, driver.tenantId)).limit(1);
      schoolCode = t?.schoolCode ?? null;
    }
    const [created] = await db
      .insert(usersTable)
      .values({
        phone: normalizedPhone,
        name: driver.name,
        role: "driver",
        tenantId: driver.tenantId,
        schoolCode,
        photoUrl: driver.photoUrl,
      })
      .returning();
    user = created;
  }

  // Case C: User exists, but neither passenger nor driver exists
  if (user && !passenger && !driver) {
    if (user.role === "student" || user.role === "staff") {
      const tenantId = user.tenantId;
      if (tenantId) {
        // Find or create default station
        let [station] = await db.select().from(stationsTable).where(eq(stationsTable.tenantId, tenantId)).limit(1);
        if (!station) {
          const [newStation] = await db
            .insert(stationsTable)
            .values({
              tenantId,
              name: "Default Station",
              lat: 27.7172,
              lng: 85.3240,
              radius: 200,
            })
            .returning();
          station = newStation;
        }

        const [createdPassenger] = await db
          .insert(passengersTable)
          .values({
            tenantId,
            name: user.name,
            phone: normalizedPhone,
            role: user.role,
            stationId: station.id,
            status: "pending",
            photoUrl: user.photoUrl,
          })
          .returning();
        passenger = createdPassenger;
      }
    } else if (user.role === "driver") {
      const tenantId = user.tenantId;
      if (tenantId) {
        const [createdDriver] = await db
          .insert(driversTable)
          .values({
            tenantId,
            name: user.name,
            phone: normalizedPhone,
            vehicleNumber: "TBD",
            isActive: false,
            photoUrl: user.photoUrl,
          })
          .returning();
        driver = createdDriver;
      }
    }
  }

  // Case D: Both exist. Make sure details are synchronized bidirectional!
  if (user) {
    if (passenger) {
      let schoolCode = user.schoolCode;
      let shouldUpdateUser = false;
      let shouldUpdatePassenger = false;

      // Sync name
      if (passenger.name !== user.name) {
        // Passenger is updated by admin, so it takes precedence unless passenger name is default/empty
        if (passenger.name) {
          user.name = passenger.name;
          shouldUpdateUser = true;
        } else if (user.name) {
          passenger.name = user.name;
          shouldUpdatePassenger = true;
        }
      }

      // Sync role
      if (passenger.role !== user.role) {
        user.role = passenger.role;
        shouldUpdateUser = true;
      }

      // Sync photo
      if (passenger.photoUrl !== user.photoUrl) {
        if (user.photoUrl && !passenger.photoUrl) {
          passenger.photoUrl = user.photoUrl;
          shouldUpdatePassenger = true;
        } else if (passenger.photoUrl && !user.photoUrl) {
          user.photoUrl = passenger.photoUrl;
          shouldUpdateUser = true;
        }
      }

      // Sync tenant
      if (passenger.tenantId !== user.tenantId) {
        user.tenantId = passenger.tenantId;
        shouldUpdateUser = true;
        if (passenger.tenantId) {
          const [t] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, passenger.tenantId)).limit(1);
          schoolCode = t?.schoolCode ?? null;
          user.schoolCode = schoolCode;
        }
      }

      if (shouldUpdateUser) {
        await db
          .update(usersTable)
          .set({
            tenantId: user.tenantId,
            role: user.role,
            schoolCode: user.schoolCode,
            name: user.name,
            photoUrl: user.photoUrl,
          })
          .where(eq(usersTable.id, user.id));
      }

      if (shouldUpdatePassenger) {
        await db
          .update(passengersTable)
          .set({
            name: passenger.name,
            photoUrl: passenger.photoUrl,
          })
          .where(eq(passengersTable.id, passenger.id));
      }
    } else if (driver) {
      let schoolCode = user.schoolCode;
      let shouldUpdateUser = false;
      let shouldUpdateDriver = false;

      // Sync name
      if (driver.name !== user.name) {
        if (driver.name) {
          user.name = driver.name;
          shouldUpdateUser = true;
        } else if (user.name) {
          driver.name = user.name;
          shouldUpdateDriver = true;
        }
      }

      // Sync role
      if (user.role !== "driver") {
        user.role = "driver";
        shouldUpdateUser = true;
      }

      // Sync photo
      if (driver.photoUrl !== user.photoUrl) {
        if (user.photoUrl && !driver.photoUrl) {
          driver.photoUrl = user.photoUrl;
          shouldUpdateDriver = true;
        } else if (driver.photoUrl && !user.photoUrl) {
          user.photoUrl = driver.photoUrl;
          shouldUpdateUser = true;
        }
      }

      // Sync tenant
      if (driver.tenantId !== user.tenantId) {
        user.tenantId = driver.tenantId;
        shouldUpdateUser = true;
        if (driver.tenantId) {
          const [t] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, driver.tenantId)).limit(1);
          schoolCode = t?.schoolCode ?? null;
          user.schoolCode = schoolCode;
        }
      }

      if (shouldUpdateUser) {
        await db
          .update(usersTable)
          .set({
            tenantId: user.tenantId,
            role: user.role,
            schoolCode: user.schoolCode,
            name: user.name,
            photoUrl: user.photoUrl,
          })
          .where(eq(usersTable.id, user.id));
      }

      if (shouldUpdateDriver) {
        await db
          .update(driversTable)
          .set({
            name: driver.name,
            photoUrl: driver.photoUrl,
          })
          .where(eq(driversTable.id, driver.id));
      }
    }
  }

  return { user, passenger, driver };
}
