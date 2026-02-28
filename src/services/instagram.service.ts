import axios from "axios";

const PAGE_ACCESS_TOKEN = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN;
const INSTAGRAM_API_URL = "https://graph.facebook.com/v21.0/me/messages";

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