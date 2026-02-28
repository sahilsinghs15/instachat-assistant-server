import { Router } from "express";
import { verifyWebhook, handleMessage } from "../controllers/webhook.controller";
import { verifyMetaSignature } from "../middlewares/verifySignatures";

const router = Router();

// Meta verification uses GET
router.get("/", verifyWebhook);

// Incoming messages use POST and require signature verification
router.post("/", verifyMetaSignature, handleMessage);

export default router;