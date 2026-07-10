import 'dotenv/config';
import rateLimit from "express-rate-limit";
export const PORT = Number(process.env.PORT) || 3000;
export const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',');
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
export const SALT_ROUNDS = 10;
export const REFRESH_COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
};
export const DEFAULT_PERIOD_HOURS = 24;
