import { Request, Response } from "express";
import { Settings } from "../entities/Settings";
import AppDataSource from "../data-source";
import { sendInstagramMessage, sendSenderAction, getInstagramUsername } from "../services/instagram.service";
import { getAIResponse } from "../services/ai.services";

/**
 * GET Webhook: Handshake verification with Meta
 */
export const verifyWebhook = (req: Request, res: Response) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
        console.log("✅ Webhook verified by Meta");
        return res.status(200).send(challenge);
    }
    res.sendStatus(403);
};

/**
 * Helper: Toggle AI on/off in the database
 */
const toggleAI = async (value: "true" | "false") => {
    const settingsRepo = AppDataSource.getRepository(Settings);
    let toggle = await settingsRepo.findOneBy({ key: "is_ai_active" });
    if (toggle) {
        toggle.value = value;
        await settingsRepo.save(toggle);
    } else {
        // Create the setting if it doesn't exist yet
        await settingsRepo.save({ key: "is_ai_active", value });
    }
};

/**
 * POST Webhook: Handling incoming Instagram messages
 */
export const handleMessage = async (req: Request, res: Response) => {
    const body = req.body;

    if (body.object === "instagram") {
        try {
            for (const entry of body.entry) {
                if (!entry.messaging || !entry.messaging[0]) {
                    console.log("⚠️ Received entry with no messaging data (test event or non-message). Skipping.");
                    continue;
                }
                const event = entry.messaging[0];

                if (event.message && !event.message.is_echo) {
                    const senderId = event.sender.id;
                    const userText = (event.message.text || "").trim();

                    // Skip non-text messages (images, stickers, voice notes, reels, etc.)
                    if (!userText) {
                        console.log(`📎 Skipping non-text message from ${senderId} (attachment/media)`);
                        continue;
                    }

                    console.log(`📩 Incoming message from sender ${senderId}: "${userText}"`);

                    // ── 1. Check for START / STOP commands (works from any user) ──
                    const command = userText.toLowerCase();
                    if (command === "stop") {
                        await toggleAI("false");
                        await sendInstagramMessage(senderId, "⏸️ AI Assistant band ho gaya hai. Phir se chalu karne ke liye 'start' bhejiye.");
                        console.log(`⏸️ AI turned OFF by sender ${senderId}`);
                        continue;
                    }
                    if (command === "start") {
                        await toggleAI("true");
                        await sendInstagramMessage(senderId, "▶️ AI Assistant chalu ho gaya hai! Ab baat karo, hum hain na! 😄");
                        console.log(`▶️ AI turned ON by sender ${senderId}`);
                        continue;
                    }

                    // ── 2. Check if AI is toggled OFF in NeonDB ──
                    const settingsRepo = AppDataSource.getRepository(Settings);
                    const toggle = await settingsRepo.findOneBy({ key: "is_ai_active" });
                    if (toggle?.value === "false") {
                        console.log("⏸️ AI Assistant is currently toggled OFF. Ignoring message.");
                        continue;
                    }

                    // ── 3. Check if AI should only respond to a specific user ──
                    const allowedUsername = process.env.ALLOWED_INSTAGRAM_USERNAME?.trim();
                    if (allowedUsername) {
                        const senderUsername = await getInstagramUsername(senderId);
                        console.log(`🔍 Username lookup result: "${senderUsername}" | Allowed: "${allowedUsername}"`);

                        if (senderUsername === null) {
                            console.warn(`⚠️ Could not resolve username for ${senderId}. Proceeding with AI reply to avoid dropping messages.`);
                        } else if (senderUsername.toLowerCase() !== allowedUsername.toLowerCase()) {
                            console.log(`🚫 Ignoring message from @${senderUsername} (only responding to @${allowedUsername})`);
                            continue;
                        } else {
                            console.log(`✅ Username matched: @${senderUsername}`);
                        }
                    }

                    // ── 4. Mark the message as "Seen" ──
                    await sendSenderAction(senderId, "mark_seen");

                    // ── 5. Start the "Typing..." bubble ──
                    await sendSenderAction(senderId, "typing_on");

                    // ── 6. Get AI Response ──
                    const aiReply = await getAIResponse(senderId, userText);

                    // ── 7. Send the final message ──
                    await sendInstagramMessage(senderId, aiReply);
                }
            }

            res.status(200).send("EVENT_RECEIVED");
        } catch (error) {
            console.error("❌ Error in handleMessage:", error);
            res.status(500).send("INTERNAL_SERVER_ERROR");
        }
    } else {
        res.sendStatus(404);
    }
};