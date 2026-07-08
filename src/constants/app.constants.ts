import 'dotenv/config';
import rateLimit from "express-rate-limit";

export const PORT: number = Number(process.env.PORT) || 3000;

export const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')

export const authLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: 'Too many requests from this IP, please try again later.'
});