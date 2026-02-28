import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

export const verifyMetaSignature = (req: any, res: Response, next: NextFunction) => {
    const signature = req.headers["x-hub-signature-256"] as string;
    
    if (!signature) {
        return res.status(401).send("Signature missing");
    }

    const elements = signature.split("=");
    const signatureHash = elements[1];
    
    // We use the rawBody we captured in app.ts
    const expectedHash = crypto
        .createHmac("sha256", process.env.APP_SECRET || "")
        .update(req.rawBody)
        .digest("hex");

    if (signatureHash !== expectedHash) {
        console.error("❌ Invalid signature detected");
        return res.status(401).send("Invalid signature");
    }
    
    next();
};