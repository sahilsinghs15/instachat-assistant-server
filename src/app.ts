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

export default app;
