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
 * POST Webhook: Handling incoming Instagram messages
 */
export const handleMessage = async (req: Request, res: Response) => {
    const body = req.body;

    if (body.object === "instagram") {
        try {
            const settingsRepo = AppDataSource.getRepository(Settings);
            const toggle = await settingsRepo.findOneBy({ key: "is_ai_active" });

            // 1. Check if AI is toggled OFF in NeonDB
            if (toggle?.value === "false") {
                console.log("⏸️ AI Assistant is currently toggled OFF.");
                return res.status(200).send("AI_DISABLED");
            }

            for (const entry of body.entry) {
                const event = entry.messaging[0];

                if (event.message && !event.message.is_echo) {
                    const senderId = event.sender.id;
                    const userText = event.message.text;

                    // 2. Check if AI should only respond to a specific user
                    const allowedUsername = process.env.ALLOWED_INSTAGRAM_USERNAME;
                    if (allowedUsername) {
                        const senderUsername = await getInstagramUsername(senderId);
                        if (senderUsername !== allowedUsername) {
                            console.log(`🚫 Ignoring message from @${senderUsername} (only responding to @${allowedUsername})`);
                            continue; // Skip this message, process next
                        }
                    }

                    // 3. Mark the message as "Seen"
                    await sendSenderAction(senderId, "mark_seen");

                    // 4. Start the "Typing..." bubble
                    await sendSenderAction(senderId, "typing_on");

                    // 5. Get AI Response (This takes 1-3 seconds)
                    const aiReply = await getAIResponse(senderId, userText);

                    // 6. Send the final message — this will turn typing off
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