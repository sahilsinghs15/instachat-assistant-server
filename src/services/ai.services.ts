import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import axios from "axios";
import { ChatHistory } from "../entities/ChatHistory";
import AppDataSource from "../data-source";

/**
 * System prompt that defines the AI's personality and behavioral rules.
 * The AI acts as Sahil Sir's assistant chatting with Sir ki wife.
 */
const SYSTEM_PROMPT = `Tu Sahil Sir ka assistant hai, Sir ki taraf se unki wife se Instagram pe baat kar raha hai. Unhe "Sir Ki Miss" bol.

KAAM: Jokes, shayari, funny baatein se mood theek kar. Hamesha respectful, warm aur caring rah.
LANGUAGE: Hindi mein reply kar. Agar wo Marathi bole toh Marathi mein. English tab hi jab wo English bole.
STYLE: "Sir Ki Miss, rukiye Sir aa rahe honge 😄" / "rukiye Sir so rahe honge 😴" jaisa bol.
LIMIT: Khud ko AI/bot mat bol — tu Sir ka assistant hai. Adult/offensive/political content mat bol. Scope se bahar ho toh bol "Sir Ki Miss, ye toh Sir se poochna padega, hum toh bas aapka mood theek karne aaye hain! 😊"
JOKES: Clean, family-friendly Hindi/Urdu shayari aur jokes. Marathi vinod bhi allowed.`;

// 1. Initialize Clients
const groq = new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: "https://api.groq.com/openai/v1" });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const geminiModel = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: SYSTEM_PROMPT,
});
const deepseek = new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: "https://api.deepseek.com" });
const grok = new OpenAI({ apiKey: process.env.XAI_API_KEY, baseURL: "https://api.x.ai/v1" });

/**
 * Only include providers whose API key is actually set (not a placeholder).
 * Priority: Groq (30 rpm free) → Gemini (15 rpm free) → DeepSeek (cheap) → Grok → OpenRouter
 */
const isValidKey = (key?: string) => !!key && !key.startsWith("your_") && key.length > 10;

const PROVIDER_PRIORITY = [
    isValidKey(process.env.GROQ_API_KEY) && "groq",
    isValidKey(process.env.GEMINI_API_KEY) && "gemini",
    isValidKey(process.env.DEEPSEEK_API_KEY) && "deepseek",
    isValidKey(process.env.XAI_API_KEY) && "grok",
    isValidKey(process.env.OPENROUTER_API_KEY) && "openrouter",
].filter(Boolean) as string[];

console.log(`🤖 Active AI providers: [${PROVIDER_PRIORITY.join(", ")}]`);

export const getAIResponse = async (senderId: string, userPrompt: string): Promise<string> => {
    const historyRepo = AppDataSource.getRepository(ChatHistory);

    // 1. Fetch last 10 messages for context (keeping it lean for free tiers)
    const previousMessages = await historyRepo.find({
        where: { sender_id: senderId },
        order: { createdAt: "ASC" },
        take: 10,
    });

    // 2. Format history for OpenAI-compatible providers (with system prompt at the start)
    const messagesContext: Array<{ role: string; content: string }> = [
        { role: "system", content: SYSTEM_PROMPT },
        ...previousMessages.map(msg => ({
            role: msg.role,
            content: msg.message
        })),
        { role: "user", content: userPrompt },
    ];

    let aiReply = "";

    // 3. Orchestrator Loop
    for (const provider of PROVIDER_PRIORITY) {
        try {
            console.log(`🤖 Orchestrator: Trying ${provider} for ${senderId}...`);

            if (provider === "groq") {
                const completion = await groq.chat.completions.create({
                    messages: messagesContext as any,
                    model: "llama-3.3-70b-versatile",
                });
                aiReply = completion.choices[0].message.content || "";
            }

            else if (provider === "grok") {
                const completion = await grok.chat.completions.create({
                    messages: messagesContext as any,
                    model: "grok-2-latest",
                });
                aiReply = completion.choices[0].message.content || "";
            }

            else if (provider === "gemini") {
                // Gemini uses systemInstruction set at model level, so we only pass history + user message
                const chat = geminiModel.startChat({
                    history: previousMessages.map(msg => ({
                        role: msg.role === "user" ? "user" : "model",
                        parts: [{ text: msg.message }],
                    })),
                });
                const result = await chat.sendMessage(userPrompt);
                aiReply = result.response.text();
            }

            else if (provider === "deepseek") {
                const completion = await deepseek.chat.completions.create({
                    messages: messagesContext as any,
                    model: "deepseek-chat",
                });
                aiReply = completion.choices[0].message.content || "";
            }

            else if (provider === "openrouter") {
                const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
                    model: "google/gemma-3-27b-it:free",
                    messages: messagesContext,
                }, {
                    headers: {
                        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                        "X-Title": "Instagram AI Assistant"
                    }
                });
                aiReply = response.data.choices[0].message.content;
            }

            if (aiReply) {
                console.log(`✅ Got response from ${provider}`);
                break; // Exit loop if we got a successful response
            }

        } catch (error: any) {
            console.error(`⚠️ ${provider} failed: ${error.message}.`);
            continue;
        }
    }

    const finalReply = aiReply || "Sir Ki Miss, thoda technical issue aa gaya hai! Ek minute mein phir try kariye! 🙏";

    // 4. Save both messages to NeonDB
    try {
        await historyRepo.save([
            { sender_id: senderId, message: userPrompt, role: "user" },
            { sender_id: senderId, message: finalReply, role: "assistant" }
        ]);
    } catch (dbError) {
        console.error("❌ Failed to save chat history:", dbError);
    }

    return finalReply;
};