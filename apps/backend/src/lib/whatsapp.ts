// WhatsApp integration removed — alerts are now delivered in-app via notifications.
// This file is kept as a stub so any legacy imports compile without errors.

export interface WhatsAppPayload {
  tenantId: number;
  to: string;
  recipientName: string;
  type: "absent" | "delay";
  passengerName?: string;
  stationName?: string;
  messageBody: string;
}

// No-op: WhatsApp sending has been replaced by in-app notifications.
export async function sendWhatsAppAlert(_payload: WhatsAppPayload): Promise<void> {
  // intentionally empty — see artifacts/api-server/src/lib/notifications.ts
}
