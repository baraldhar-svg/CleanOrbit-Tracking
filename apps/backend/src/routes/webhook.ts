import { Router, type IRouter } from "express";

const router: IRouter = Router();

/**
 * Meta (Facebook/WhatsApp) Webhook Verification Endpoint
 * Meta Dashboard Webhook URL: https://clean-orbit-tracking.vercel.app/webhook (or /api/webhook)
 * Verify Token: orbittrack1234
 */
router.get("/", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  const MY_VERIFY_TOKEN = "orbittrack1234";

  if (mode === "subscribe" && token === MY_VERIFY_TOKEN) {
    // Return hub.challenge string directly with HTTP 200 as required by Meta
    return res.status(200).send(challenge);
  } else {
    return res.status(403).send("Forbidden");
  }
});

/**
 * Incoming Webhook Events from Meta/WhatsApp
 */
router.post("/", (req, res) => {
  // Acknowledge event reception to Meta immediately
  return res.status(200).send("EVENT_RECEIVED");
});

export default router;
