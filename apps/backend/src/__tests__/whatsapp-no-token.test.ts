// WhatsApp integration removed — alerts are now delivered in-app via notifications.
import { describe, it, expect } from "vitest";
import { sendWhatsAppAlert } from "../lib/whatsapp";

describe("sendWhatsAppAlert stub", () => {
  it("no-op resolves without error (absent)", async () => {
    await expect(
      sendWhatsAppAlert({
        tenantId: 1,
        to: "977984000000",
        recipientName: "Test Parent",
        type: "absent",
        messageBody: "test",
      }),
    ).resolves.toBeUndefined();
  });

  it("no-op resolves without error (delay)", async () => {
    await expect(
      sendWhatsAppAlert({
        tenantId: 1,
        to: "977984000000",
        recipientName: "Test Parent",
        type: "delay",
        messageBody: "test",
      }),
    ).resolves.toBeUndefined();
  });
});
