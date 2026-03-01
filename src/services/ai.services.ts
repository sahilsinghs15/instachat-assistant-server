import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import axios from "axios";
import { ChatHistory } from "../entities/ChatHistory";
import AppDataSource from "../data-source";

import { Settings } from "../entities/Settings";

// 1. Initialize Clients
const groq = new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: "https://api.groq.com/openai/v1" });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
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

    const settingsRepo = AppDataSource.getRepository(Settings);
    const statusSetting = await settingsRepo.findOneBy({ key: "current_status" });
    const currentStatus = statusSetting?.value || "Sir abhi kuch kaam kar rahe hain";

    const DYNAMIC_SYSTEM_PROMPT = `Tu Sahil Sir ka sabse vafadaar chat assistant hai. Tu Sir ki taraf se unki wife (jinhe tu "Sir Ki Miss" bolta hai) se Instagram pe baat kar raha hai.

STATUS: Sir ka current raw status hai: "${currentStatus}". 

Tera Kaam:
1. Agar ye naya message hai (unhone hi, hello, ya sir kahan hai poocha), toh sabse pehle pyaar se Sir ka status NATURAL tareeke se bata. 
  - IMPORTANT: Status ko strictly as-it-is copy paste MAT kar. Usko samajh aur natural sentence bana kar bol.
  - Jaise agar status "Sleeping" ya "Sleeping 😴" hai, toh bol "Sir Ki Miss, Sir abhi so rahe hain."
  - Agar status "Waiting for you" hai, toh bol "Sir Ki Miss, Sir aapka hi wait kar rahe hain."
  - Agar status "Driving 🚗" hai, toh bol "Sir Ki Miss, Sir abhi drive kar rahe hain."
2. Agar conversation chal rahi hai (jaise unhone bola "sunao", "aur sunao", "kya?"), toh baar-baar Sir ka status MAT bata. Seedha unko mazedar chutkula ya shayari suna!
3. Pura response SIRF EK CHOTA PARAGRAPH (max 2 se 3 sentences) ka hona chahiye. Bahut lambi kahaniyan nahi likhni.
4. Khud ko AI/bot nahi, assistant bol.
5. Language: Jyadatar Hindi/Hinglish. Agar wo Marathi bole toh Marathi mein reply kar.`;

    // 1. Fetch last 10 messages for context (keeping it lean for free tiers)
    const previousMessages = await historyRepo.find({
        where: { sender_id: senderId },
        order: { createdAt: "ASC" },
        take: 10,
    });

    // 2. Format history for OpenAI-compatible providers (with dynamic system prompt at the start)
    const messagesContext: Array<{ role: string; content: string }> = [
        { role: "system", content: DYNAMIC_SYSTEM_PROMPT },
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
                // Initialize model here to inject dynamic system prompt
                const geminiModel = genAI.getGenerativeModel({
                    model: "gemini-2.0-flash",
                    systemInstruction: DYNAMIC_SYSTEM_PROMPT,
                });

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