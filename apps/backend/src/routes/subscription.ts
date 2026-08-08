import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

// Mock endpoint for handling payments via eSewa / FonePay
router.post("/checkout", requireAuth, async (req, res) => {
  try {
    const { planMonths } = req.body;
    const userId = (req as any).user.userId;
    
    if (![1, 3, 6, 12].includes(planMonths)) {
      return res.status(400).json({ error: "Invalid plan selected" });
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) return res.status(404).json({ error: "User not found" });

    // Calculate new expiration date
    const now = new Date();
    const currentExpiry = user.subscriptionExpiresAt && user.subscriptionExpiresAt > now 
      ? new Date(user.subscriptionExpiresAt) 
      : now;
      
    currentExpiry.setMonth(currentExpiry.getMonth() + planMonths);

    await db.update(usersTable)
      .set({ subscriptionExpiresAt: currentExpiry })
      .where(eq(usersTable.id, userId));

    return res.json({ 
      success: true, 
      message: `Successfully subscribed for ${planMonths} month(s)`,
      expiresAt: currentExpiry 
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Admin endpoint to manually activate a user
router.post("/admin/activate-user", requireAuth, async (req, res) => {
  try {
    const { targetUserId, isManuallyActivated } = req.body;
    
    // Only superadmin or admin can do this
    if ((req as any).user.role !== "superadmin" && (req as any).user.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized" });
    }

    await db.update(usersTable)
      .set({ isManuallyActivated: !!isManuallyActivated })
      .where(eq(usersTable.id, targetUserId));

    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
