import { Router } from "express";
import { db } from "@workspace/db";
import { vehiclesTable, vehicleLocationsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router = Router();

// POST /api/gps
router.post("/", async (req, res) => {
  try {
    const plateNumberRaw = req.body.plate_number ?? req.body.plateNumber;
    const latitudeRaw = req.body.latitude;
    const longitudeRaw = req.body.longitude;
    const speedRaw = req.body.speed;
    const headingRaw = req.body.heading;

    if (!plateNumberRaw || typeof plateNumberRaw !== "string") {
      res.status(400).json({ error: "Missing or invalid plate_number" });
      return;
    }

    const plateNumber = plateNumberRaw.trim();
    if (!plateNumber) {
      res.status(400).json({ error: "plate_number cannot be empty" });
      return;
    }

    const latitude = parseFloat(String(latitudeRaw));
    const longitude = parseFloat(String(longitudeRaw));

    if (isNaN(latitude) || isNaN(longitude)) {
      res.status(400).json({ error: "Invalid latitude or longitude" });
      return;
    }

    const speed = speedRaw !== undefined ? parseFloat(String(speedRaw)) : null;
    const heading = headingRaw !== undefined ? parseFloat(String(headingRaw)) : null;

    // 1. Find the vehicle in the database by plate number
    let vehicle = await db
      .select()
      .from(vehiclesTable)
      .where(eq(sql`LOWER(${vehiclesTable.plateNumber})`, plateNumber.toLowerCase()))
      .then((rows) => rows[0]);

    // 2. If the vehicle doesn't exist, we automatically create a placeholder
    // under the current tenant context (req.tenantId, defaults to 1) so it doesn't fail.
    if (!vehicle) {
      const tenantId = req.tenantId ?? 1;
      const [newVehicle] = await db
        .insert(vehiclesTable)
        .values({
          tenantId,
          plateNumber,
          model: "Simulated Orbit Bus",
          capacity: 40,
          isActive: true,
        })
        .returning();
      vehicle = newVehicle;
    }

    // 3. Upsert the vehicle location
    const existingLocation = await db
      .select()
      .from(vehicleLocationsTable)
      .where(eq(vehicleLocationsTable.vehicleId, vehicle.id))
      .then((rows) => rows[0]);

    let updatedLocation;
    if (existingLocation) {
      // Update
      const [updated] = await db
        .update(vehicleLocationsTable)
        .set({
          plateNumber: vehicle.plateNumber,
          latitude,
          longitude,
          speed,
          heading,
          updatedAt: new Date(),
        })
        .where(eq(vehicleLocationsTable.vehicleId, vehicle.id))
        .returning();
      updatedLocation = updated;
    } else {
      // Insert
      const [inserted] = await db
        .insert(vehicleLocationsTable)
        .values({
          vehicleId: vehicle.id,
          plateNumber: vehicle.plateNumber,
          latitude,
          longitude,
          speed,
          heading,
          updatedAt: new Date(),
        })
        .returning();
      updatedLocation = inserted;
    }

    res.status(200).json({
      success: true,
      message: "GPS ping processed and location updated successfully",
      data: updatedLocation,
    });
  } catch (error: any) {
    console.error("Error updating GPS location:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error.message,
    });
  }
});

export default router;
