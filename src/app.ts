import express from "express";
import webhookRoutes from "./routes/webhook.routes";

const app = express();

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

export default app;