import 'dotenv/config';
import rateLimit from "express-rate-limit";

export const PORT: number = Number(process.env.PORT) || 3000;

export const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')

export const authLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: 'Too many requests from this IP, please try again later.'
});

export const insightsLimit = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: 'Слишком много запросов к AI-Insights, попробуйте позже.'
});

export const registerLimit = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: 'Too many registration attempts from this IP, please try again later.'
});

export const loginLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: 'Too many login attempts from this IP, please try again later.'
});

export const refreshLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    message: 'Too many refresh attempts from this IP, please try again later.'
});

export const SALT_ROUNDS = 10;

export const REFRESH_COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 7 * 24 * 60 * 60 * 1000
};

export const DEFAULT_PERIOD_HOURS = 24;

export const RETRYABLE_STATUS_CODES = new Set([429, 503]);
export const MAX_RETRIES = 2;
export const BASE_RETRY_DELAY_MS = 500;