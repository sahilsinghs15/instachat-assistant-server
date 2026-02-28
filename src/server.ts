import "reflect-metadata";
import app from "./app";
import AppDataSource from "./data-source";
import https from "https";
import http from "http";

const PORT = process.env.PORT || 3000;

/**
 * Self-ping keep-alive to prevent Render free tier from sleeping.
 * Pings the /ping endpoint every 5 minutes.
 * Uses RENDER_EXTERNAL_URL (auto-set by Render) or custom SERVER_URL.
 */
const startKeepAlive = () => {
    const serverUrl = process.env.RENDER_EXTERNAL_URL || process.env.SERVER_URL;

    if (!serverUrl) {
        console.log("⏭️  No RENDER_EXTERNAL_URL or SERVER_URL set — skipping keep-alive (local dev).");
        return;
    }

    const pingUrl = `${serverUrl}/ping`;
    const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

    console.log(`⏰ Keep-alive started: pinging ${pingUrl} every 5 minutes`);

    setInterval(() => {
        const client = pingUrl.startsWith("https") ? https : http;
        client.get(pingUrl, (res) => {
            console.log(`🏓 Keep-alive ping — Status: ${res.statusCode}`);
        }).on("error", (err) => {
            console.error("❌ Keep-alive ping failed:", err.message);
        });
    }, INTERVAL_MS);
};

AppDataSource.initialize()
    .then(() => {
        console.log("🚀 NeonDB Connected via TypeORM");
        app.listen(PORT, () => {
            console.log(`Server listening on port ${PORT}`);
            startKeepAlive();
        });
    })
    .catch((error) => console.error("Database Error:", error));