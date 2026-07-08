import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

vi.mock('../src/prisma.js', () => ({
    prisma: {
        user: {
            findUnique: vi.fn(),
        },
        refreshToken: {
            create: vi.fn(),
            findUnique: vi.fn(),
            delete: vi.fn(),
            deleteMany: vi.fn(),
        },
    },
}));


vi.mock('bcrypt', () => ({
    default: {
        compare: vi.fn(),
    },
}));

vi.mock('jsonwebtoken', () => ({
    default: {
        sign: vi.fn(),
        verify: vi.fn(),
    },
}));

vi.mock('../src/services/users.service.js', () => ({
    createUser: vi.fn(),
}));

vi.mock('../src/utils/logger.js', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

import { prisma } from '../src/prisma.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import * as usersService from '../src/services/users.service.js';

let authService: typeof import('../src/services/auth.services.js');

beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

    authService = await import('../src/services/auth.services.js');
});

beforeEach(() => {
    vi.clearAllMocks();
});

describe('auth.services', () => {

    describe('register', () => {
        it('создаёт пользователя и возвращает его без пароля', async () => {
            const createdUser = {
                id: 1,
                email: 'test@example.com',
                name: 'Test',
                role: 'USER',
                createdAt: new Date(),
            };

            vi.mocked(usersService.createUser).mockResolvedValue(createdUser as any);

            const result = await authService.register('test@example.com', 'plainPassword', 'Test');

            expect(usersService.createUser).toHaveBeenCalledWith('Test', 'test@example.com', 'plainPassword');
            expect(result).not.toHaveProperty('password');
            expect(result).toEqual({
                id: 1,
                email: 'test@example.com',
                name: 'Test',
                role: 'USER',
                createdAt: createdUser.createdAt,
            });
        });
    });

    describe('login', () => {
        it('бросает ошибку, если пользователь не найден', async () => {
            vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

            await expect(authService.login('unknown@example.com', 'password'))
                .rejects.toThrow('INVALID_CREDENTIALS');

            expect(bcrypt.compare).not.toHaveBeenCalled();
        });

        it('бросает ошибку при неверном пароле', async () => {
            vi.mocked(prisma.user.findUnique).mockResolvedValue({
                id: 1,
                email: 'test@example.com',
                password: 'hashed',
                role: 'USER',
            } as any);
            vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

            await expect(authService.login('test@example.com', 'wrongPassword'))
                .rejects.toThrow('INVALID_CREDENTIALS');

            expect(prisma.refreshToken.create).not.toHaveBeenCalled();
        });

        it('возвращает токены и сохраняет refresh-токен при успешном логине', async () => {
            vi.mocked(prisma.user.findUnique).mockResolvedValue({
                id: 1,
                email: 'test@example.com',
                password: 'hashed',
                role: 'USER',
            } as any);
            vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
            vi.mocked(jwt.sign)
                .mockReturnValueOnce('access-token' as any)
                .mockReturnValueOnce('refresh-token' as any);

            const result = await authService.login('test@example.com', 'correctPassword');

            expect(result).toEqual({ accessToken: 'access-token', refreshToken: 'refresh-token' });
            expect(prisma.refreshToken.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        token: 'refresh-token',
                        userId: 1,
                    }),
                })
            );
        });
    });

    describe('refresh', () => {
        it('бросает ошибку при невалидной подписи токена', async () => {
            vi.mocked(jwt.verify).mockImplementation(() => {
                throw new Error('invalid signature');
            });

            await expect(authService.refresh('bad-token'))
                .rejects.toThrow('INVALID_REFRESH_TOKEN');

            expect(prisma.refreshToken.findUnique).not.toHaveBeenCalled();
        });

        it('бросает ошибку и отзывает все токены пользователя, если токен не найден в БД', async () => {
            vi.mocked(jwt.verify).mockReturnValue({ userId: 1 } as any);
            vi.mocked(prisma.refreshToken.findUnique).mockResolvedValue(null);

            await expect(authService.refresh('valid-but-unknown-token'))
                .rejects.toThrow('INVALID_REFRESH_TOKEN');

            expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: 1 } });
        });

        it('бросает ошибку и удаляет токен, если он просрочен', async () => {
            vi.mocked(jwt.verify).mockReturnValue({ userId: 1 } as any);
            vi.mocked(prisma.refreshToken.findUnique).mockResolvedValue({
                id: 10,
                token: 'expired-token',
                userId: 1,
                expiresAt: new Date(Date.now() - 1000),
            } as any);

            await expect(authService.refresh('expired-token'))
                .rejects.toThrow('INVALID_REFRESH_TOKEN');

            expect(prisma.refreshToken.delete).toHaveBeenCalledWith({ where: { id: 10 } });
            expect(prisma.user.findUnique).not.toHaveBeenCalled();
        });

        it('бросает ошибку, если пользователь не найден', async () => {
            vi.mocked(jwt.verify).mockReturnValue({ userId: 1 } as any);
            vi.mocked(prisma.refreshToken.findUnique).mockResolvedValue({
                id: 10,
                token: 'valid-token',
                userId: 1,
                expiresAt: new Date(Date.now() + 1000 * 60 * 60),
            } as any);
            vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

            await expect(authService.refresh('valid-token'))
                .rejects.toThrow('INVALID_REFRESH_TOKEN');
        });

        it('ротирует токен и возвращает новую пару при успехе', async () => {
            vi.mocked(jwt.verify).mockReturnValue({ userId: 1 } as any);
            vi.mocked(prisma.refreshToken.findUnique).mockResolvedValue({
                id: 10,
                token: 'old-refresh-token',
                userId: 1,
                expiresAt: new Date(Date.now() + 1000 * 60 * 60),
            } as any);
            vi.mocked(prisma.user.findUnique).mockResolvedValue({
                id: 1,
                role: 'USER',
            } as any);
            vi.mocked(jwt.sign)
                .mockReturnValueOnce('new-access-token' as any)
                .mockReturnValueOnce('new-refresh-token' as any);

            const result = await authService.refresh('old-refresh-token');

            expect(prisma.refreshToken.delete).toHaveBeenCalledWith({ where: { id: 10 } });
            expect(prisma.refreshToken.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        token: 'new-refresh-token',
                        userId: 1,
                    }),
                })
            );
            expect(result).toEqual({ accessToken: 'new-access-token', refreshToken: 'new-refresh-token' });
        });
    });

    describe('logout', () => {
        it('удаляет refresh-токен по значению токена', async () => {
            await authService.logout('some-refresh-token');

            expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { token: 'some-refresh-token' } });
        });

        it('не бросает ошибку, если токена уже нет в БД (идемпотентность)', async () => {
            vi.mocked(prisma.refreshToken.deleteMany).mockResolvedValue({ count: 0 } as any);

            await expect(authService.logout('already-deleted-token')).resolves.not.toThrow();
        });
    });
});