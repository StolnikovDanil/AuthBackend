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

const generateTokens = (userId: number, role: string) => {
    const accessToken = jwt.sign({ userId, role }, ACCESS_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ userId, role }, REFRESH_SECRET, { expiresIn: '7d' });
    return { accessToken, refreshToken };
};

export const register = async (email: string, password: string, name?: string) => {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await usersService.createUser(name, email, hashedPassword);

    logger.info({ userId: user.id, email: user.email }, 'User registered');

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
};

export const login = async (email: string, password: string) => {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        logger.warn({ email }, 'Login attempt with unknown email');
        throw new Error('INVALID_CREDENTIALS');
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
        logger.warn({ userId: user.id, email }, 'Login attempt with wrong password');
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

    logger.info({ userId: user.id, email }, 'User logged in');

    return { accessToken, refreshToken };
};

export const refresh = async (oldRefreshToken: string) => {

    let payload: { userId: number };

    try {
        payload = jwt.verify(oldRefreshToken, REFRESH_SECRET) as { userId: number };
    } catch (err) {
        logger.warn('Refresh attempt with invalid token signature');
        throw new Error('INVALID_REFRESH_TOKEN');
    }

    const storedToken = await prisma.refreshToken.findUnique(
        { where: { token: oldRefreshToken } });

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

    await prisma.refreshToken.delete({ where: { id: storedToken.id } })

    const { accessToken, refreshToken } = generateTokens(user.id, user.role);

    await prisma.refreshToken.create({
        data: {
            token: refreshToken,
            userId: user.id,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
    })

    logger.info({ userId: user.id }, 'Token refreshed');

    return { accessToken, refreshToken };
}

export const logout = async (refreshToken: string) => {
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    logger.info('User logged out');
}