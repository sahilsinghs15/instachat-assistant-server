import axios from "axios";

const INSTAGRAM_API_URL = "https://graph.instagram.com/v25.0/me/messages";

const PAGE_ACCESS_TOKEN = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN || "";

// Cache: IGSID → username (avoids calling the API on every message)
const usernameCache: Map<string, string> = new Map();

/**
 * Looks up the Instagram username from a sender's IGSID.
 * Results are cached in memory so the API is only called once per user.
 */
export const getInstagramUsername = async (senderId: string): Promise<string | null> => {
    // Check cache first
    if (usernameCache.has(senderId)) {
        return usernameCache.get(senderId)!;
    }

    try {
        const response = await axios.get(`https://graph.instagram.com/v25.0/${senderId}`, {
            params: {
                fields: "name,username",
                access_token: PAGE_ACCESS_TOKEN,
            },
        });
        const username = response.data.username || null;
        if (username) {
            usernameCache.set(senderId, username);
        }
        console.log(`👤 Resolved sender ${senderId} → @${username}`);
        return username;
    } catch (error: any) {
        console.error(`❌ Failed to lookup username for ${senderId}:`, error.response?.data || error.message);
        return null;
    }
};

/**
 * Sends a sender action (typing_on, typing_off, or mark_seen)
 */
export const sendSenderAction = async (recipientId: string, action: "typing_on" | "typing_off" | "mark_seen") => {
    try {
        await axios.post(
            INSTAGRAM_API_URL,
            {
                recipient: { id: recipientId },
                sender_action: action,
            },
            { params: { access_token: PAGE_ACCESS_TOKEN } }
        );
    } catch (error: any) {
        console.error(`❌ Failed to send action ${action}:`, error.response?.data || error.message);
    }
};

export const sendInstagramMessage = async (recipientId: string, text: string) => {
    try {
        await axios.post(
            INSTAGRAM_API_URL,
            {
                recipient: { id: recipientId },
                message: { text: text },
            },
            {
                params: { access_token: PAGE_ACCESS_TOKEN },
            }
        );
        console.log(`✅ Reply sent to ${recipientId}`);
    } catch (error: any) {
        console.error("❌ Error sending Instagram message:", error.response?.data || error.message);
    }
};