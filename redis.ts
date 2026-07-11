import { Redis } from 'ioredis';
import 'dotenv/config';
import { logger} from "./src/utils/logger.js";

const REDIS_URL = process.env.REDIS_URL;

if (!REDIS_URL) {
    throw new Error('REDIS_URL must be set');
}

export const redis = new Redis(REDIS_URL);

redis.on('error', (err: Error): void => {
    logger.error({ err }, 'Redis connection error');
});

redis.on('connect', (): void => {
    logger.info('Redis connected');
});