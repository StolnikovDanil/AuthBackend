import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma.js';
import * as usersService from './users.service.js';
import { logger } from '../utils/logger.js';
const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
if (!ACCESS_SECRET || !REFRESH_SECRET) {
    throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be set');
}
const generateTokens = (userId, role) => {
    const accessToken = jwt.sign({ userId, role }, ACCESS_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ userId, role }, REFRESH_SECRET, { expiresIn: '7d' });
    return { accessToken, refreshToken };
};
const recordLoginAttempt = async ({ userId, email, success, ip, userAgent }) => {
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
    }
    catch (err) {
        logger.error({ err, email }, 'Failed to record login attempt');
    }
};
export const register = async (email, password, name) => {
    const user = await usersService.createUser(name, email, password);
    logger.info({ userId: user.id, email: user.email }, 'User registered');
    return user;
};
export const login = async (email, password, ip, userAgent) => {
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
    const { accessToken, refreshToken } = generateTokens(user.id, user.role);
    await prisma.refreshToken.create({
        data: {
            token: refreshToken,
            userId: user.id,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
    });
    await recordLoginAttempt({ userId: user.id, email, success: true, ip, userAgent });
    logger.info({ userId: user.id, email }, 'User logged in');
    return { accessToken, refreshToken };
};
export const refresh = async (oldRefreshToken) => {
    let payload;
    try {
        payload = jwt.verify(oldRefreshToken, REFRESH_SECRET);
    }
    catch (err) {
        logger.warn('Refresh attempt with invalid token signature');
        throw new Error('INVALID_REFRESH_TOKEN');
    }
    const storedToken = await prisma.refreshToken.findUnique({ where: { token: oldRefreshToken } });
    if (!storedToken) {
        logger.warn({ userId: payload.userId }, 'Refresh attempt with token not found in DB (possibly reused/stolen)');
        await prisma.refreshToken.deleteMany({ where: { userId: payload.userId } });
        throw new Error('INVALID_REFRESH_TOKEN');
    }
    if (storedToken.expiresAt < new Date()) {
        await prisma.refreshToken.delete({ where: { id: storedToken.id } });
        logger.warn({ userId: payload.userId }, 'Refresh attempt with expired token');
        throw new Error('INVALID_REFRESH_TOKEN');
    }
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) {
        logger.warn({ userId: payload.userId }, 'Refresh attempt for non-existent user');
        throw new Error('INVALID_REFRESH_TOKEN');
    }
    await prisma.refreshToken.delete({ where: { id: storedToken.id } });
    const { accessToken, refreshToken } = generateTokens(user.id, user.role);
    await prisma.refreshToken.create({
        data: {
            token: refreshToken,
            userId: user.id,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
    });
    logger.info({ userId: user.id }, 'Token refreshed');
    return { accessToken, refreshToken };
};
export const logout = async (refreshToken) => {
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    logger.info('User logged out');
};
