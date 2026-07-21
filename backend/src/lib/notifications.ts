import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db";
import { broadcast } from "./sse";
import { logger } from "./logger";

export interface NotificationPayload {
  tenantId: number;
  passengerId?: number;
  type: "absent" | "delay" | "boarding" | "announcement";
  title: string;
  body: string;
}

export async function createNotification(payload: NotificationPayload): Promise<void> {
  try {
    const [row] = await db.insert(notificationsTable).values({
      tenantId: payload.tenantId,
      passengerId: payload.passengerId ?? null,
      type: payload.type,
      title: payload.title,
      body: payload.body,
    }).returning();

    broadcast(payload.tenantId, "notification", {
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      passengerId: row.passengerId,
      createdAt: row.createdAt,
    });
  } catch (err) {
    logger.error({ err }, "Failed to create in-app notification");
  }
}
