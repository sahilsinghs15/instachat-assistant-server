import express from "express";
import webhookRoutes from "./routes/webhook.routes";

const app = express();

// Log ALL incoming requests (helps debug webhook issues)
app.use((req, res, next) => {
    console.log(`📡 ${req.method} ${req.path} from ${req.ip}`);
    next();
});

// Capture Raw Body for Signature Verification
app.use(express.json({
    verify: (req: any, res, buf) => {
        req.rawBody = buf;
    }
}));

// Routes
app.use("/webhook", webhookRoutes);

// Health Check
app.get("/ping", (req, res) => res.send("pong"));

// Debug endpoint — check server status and config
app.get("/debug", (req, res) => {
    res.json({
        status: "running",
        timestamp: new Date().toISOString(),
        webhookUrl: "/webhook",
        allowedUser: process.env.ALLOWED_INSTAGRAM_USERNAME || "not set",
        hasPageToken: !!process.env.INSTAGRAM_PAGE_ACCESS_TOKEN,
        hasAppSecret: !!process.env.APP_SECRET,
        hasVerifyToken: !!process.env.VERIFY_TOKEN,
    });
});

import { Settings } from "./entities/Settings";
import AppDataSource from "./data-source";

// API Endpoint for the upcoming Flutter Mobile App to change the AI's current status and start/stop the AI
app.post("/api/status", async (req, res) => {
    try {
        const { status } = req.body;
        if (!status && status !== "") {
            return res.status(400).json({ error: "Please provide a 'status' in the JSON body" });
        }

        const settingsRepo = AppDataSource.getRepository(Settings);

        // Handle start and stop commands to toggle AI on/off
        const lowerStatus = status.toLowerCase().trim();
        if (lowerStatus === "stop" || lowerStatus === "start") {
            const isAiActive = lowerStatus === "start" ? "true" : "false";

            let toggleSetting = await settingsRepo.findOneBy({ key: "is_ai_active" });
            if (toggleSetting) {
                toggleSetting.value = isAiActive;
                await settingsRepo.save(toggleSetting);
            } else {
                await settingsRepo.save({ key: "is_ai_active", value: isAiActive });
            }
            console.log(`📱 Mobile App updated AI status to: ${isAiActive === "true" ? "ON" : "OFF"}`);
            return res.json({ success: true, message: `AI Assistant turned ${isAiActive === "true" ? "ON" : "OFF"} successfully`, currentStatus: isAiActive === "true" ? "Active" : "Stopped" });
        }

        // For regular status updates
        let statusSetting = await settingsRepo.findOneBy({ key: "current_status" });

        if (statusSetting) {
            statusSetting.value = status;
            await settingsRepo.save(statusSetting);
        } else {
            await settingsRepo.save({ key: "current_status", value: status });
        }

        console.log(`📱 Mobile App updated status to: "${status}"`);
        res.json({ success: true, message: "Status updated successfully", currentStatus: status });
    } catch (error) {
        console.error("Failed to update status:", error);
        res.status(500).json({ error: "Failed to update status in Database" });
    }
});

export default app;
