import type { Request, Response } from "express";
import { emitRateLimitEvent } from "../socket.js";
import type { RateLimiterName } from "../types/rate-limiter-name.js";

type RequestWithRateLimit = Request & {
    rateLimit?: {
        resetTime?: Date;
    };
};

export const buildRateLimitHandler = (limiter: RateLimiterName, message: string) =>
    (req: RequestWithRateLimit, res: Response) => {
        const resetTime = req.rateLimit?.resetTime;
        const resetAt = (resetTime ?? new Date()).toISOString();
        const retryAfterMs = resetTime ? Math.max(0, resetTime.getTime() - Date.now()) : 0;

        emitRateLimitEvent(req.ip ?? 'unknown', { limiter, resetAt, retryAfterMs });

        res.status(429).json({ error: message, resetAt, retryAfterMs });
    };