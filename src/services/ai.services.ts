import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import axios from "axios";
import { ChatHistory } from "../entities/ChatHistory";
import AppDataSource from "../data-source";

// 1. Initialize Clients
const grok = new OpenAI({ apiKey: process.env.XAI_API_KEY, baseURL: "https://api.x.ai/v1" });
const groq = new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: "https://api.groq.com/openai/v1" });
const deepseek = new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: "https://api.deepseek.com" });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

const PROVIDER_PRIORITY = ["groq", "gemini", "grok", "deepseek", "openrouter"];

export const getAIResponse = async (senderId: string, userPrompt: string): Promise<string> => {
    const historyRepo = AppDataSource.getRepository(ChatHistory);

    // 1. Fetch last 6-10 messages for context (keeping it lean for free tiers)
    const previousMessages = await historyRepo.find({
        where: { sender_id: senderId },
        order: { createdAt: "ASC" },
        take: 10,
    });

    // 2. Format history for OpenAI-compatible providers
    const messagesContext = previousMessages.map(msg => ({
        role: msg.role,
        content: msg.message
    }));

    // Add the new user message to the context
    messagesContext.push({ role: "user", content: userPrompt });

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
                // Gemini uses a slightly different format for history
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

            if (aiReply) break; // Exit loop if we got a successful response

        } catch (error: any) {
            console.error(`⚠️ ${provider} failed: ${error.message}.`);
            continue;
        }
    }

    const finalReply = aiReply || "I'm having a quick technical refresh. Please try again!";

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