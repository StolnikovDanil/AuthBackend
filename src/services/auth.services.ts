import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma.js';
import { redis} from "../../redis.js";
import * as usersService from './users.service.js';
import { notifyIfNewDevice } from '../hooks/onNewDeviceLogin.js';
import { logger } from '../utils/logger.js';
import type { LoginAttempt } from '../types/login-attempt.js';
import {REFRESH_GRACE_MS, REFRESH_TTL_MS} from "../constants/app.constants.js";
import type {StoredRefreshToken} from "../types/stored-refresh-token.js";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

if (!ACCESS_SECRET || !REFRESH_SECRET) {
    throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be set');
}

const hashToken = (token: string): string =>
    crypto.createHash('sha256').update(token).digest('hex');

const refreshKey = (token: string): string => `refresh:${hashToken(token)}`;

const generateTokens = (userId: number, role: string) => {
    const accessToken = jwt.sign({ userId, role }, ACCESS_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ userId, role }, REFRESH_SECRET, { expiresIn: '7d' });
    return { accessToken, refreshToken };
};

const storeRefreshToken = async (token: string, userId: number, role: string): Promise<void> => {
    const expiresAt = Date.now() + REFRESH_TTL_MS;
    const value: StoredRefreshToken = { userId, role, expiresAt };
    await redis.set(refreshKey(token), JSON.stringify(value), 'PX', REFRESH_TTL_MS + REFRESH_GRACE_MS);
};

const recordLoginAttempt = async ({ userId, email, success, ip, userAgent }: LoginAttempt) => {
    try {
        await prisma.loginAttempt.create({
            data: {
                userId,
                email,
                success,
                ip,
                userAgent: userAgent ?? null
            }
        });
    } catch (err) {
        logger.error({ err, email }, 'Failed to record login attempt');
    }
};

export const register = async (email: string, password: string, name?: string) => {
    const user = await usersService.createUser(name, email, password);
    logger.info({ userId: user.id, email: user.email }, 'User registered');
    return user;
};

export const login = async (email: string, password: string, ip: string, userAgent?: string | null) => {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        logger.warn({ email }, 'Login attempt with unknown email');
        await recordLoginAttempt({ userId: null, email, success: false, ip, userAgent });
        throw new Error('INVALID_CREDENTIALS');
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
        logger.warn({ userId: user.id, email }, 'Login attempt with wrong password');
        await recordLoginAttempt({ userId: user.id, email, success: false, ip, userAgent });
        throw new Error('INVALID_CREDENTIALS');
    }

    await notifyIfNewDevice(user.id, ip, userAgent);

    const { accessToken, refreshToken } = generateTokens(user.id, user.role);
    await storeRefreshToken(refreshToken, user.id, user.role);

    await recordLoginAttempt({ userId: user.id, email, success: true, ip, userAgent });

    logger.info({ userId: user.id, email }, 'User logged in');

    return { accessToken, refreshToken };
};

export const refresh = async (oldRefreshToken: string) => {

    let payload: { userId: number; role: string };

    try {
        payload = jwt.verify(oldRefreshToken, REFRESH_SECRET) as { userId: number; role: string };
    } catch (err) {
        logger.warn('Refresh attempt with invalid token signature');
        throw new Error('INVALID_REFRESH_TOKEN');
    }

    const raw = await redis.getdel(refreshKey(oldRefreshToken));

    if (!raw) {
        logger.warn(
            { userId: payload.userId },
            'Refresh token already consumed (concurrent request or reuse) - rejecting without mass session invalidation'
        );
        throw new Error('INVALID_REFRESH_TOKEN');
    }

    const stored = JSON.parse(raw) as StoredRefreshToken;

    if (stored.expiresAt < Date.now()) {
        logger.warn({ userId: payload.userId }, 'Refresh attempt with expired token');
        throw new Error('INVALID_REFRESH_TOKEN');
    }

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });

    if (!user) {
        logger.warn({ userId: payload.userId }, 'Refresh attempt for non-existent user');
        throw new Error('INVALID_REFRESH_TOKEN');
    }

    const { accessToken, refreshToken } = generateTokens(user.id, user.role);
    await storeRefreshToken(refreshToken, user.id, user.role);

    logger.info({ userId: user.id }, 'Token refreshed');

    return { accessToken, refreshToken };
}

export const logout = async (refreshToken: string) => {
    await redis.del(refreshKey(refreshToken));
    logger.info('User logged out');
}