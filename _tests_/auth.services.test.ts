import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

vi.mock('../src/prisma.js', () => ({
    prisma: {
        user: {
            findUnique: vi.fn(),
        },
        loginAttempt: {
            create: vi.fn(),
        },
    },
}));

vi.mock('../redis.js', () => ({
    redis: {
        set: vi.fn(),
        getdel: vi.fn(),
        del: vi.fn(),
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
import { redis} from "../redis.js";
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import * as usersService from '../src/services/users.service.js';

let authService: typeof import('../src/services/auth.services.js');

const TEST_IP = '127.0.0.1';
const TEST_USER_AGENT = 'vitest-agent';

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
        it('бросает ошибку, если пользователь не найден, и логирует попытку с userId: null', async () => {
            vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

            await expect(authService.login('unknown@example.com', 'password', TEST_IP, TEST_USER_AGENT))
                .rejects.toThrow('INVALID_CREDENTIALS');

            expect(bcrypt.compare).not.toHaveBeenCalled();
            expect(prisma.loginAttempt.create).toHaveBeenCalledWith({
                data: {
                    userId: null,
                    email: 'unknown@example.com',
                    success: false,
                    ip: TEST_IP,
                    userAgent: TEST_USER_AGENT,
                },
            });
        });

        it('бросает ошибку при неверном пароле и логирует неуспешную попытку', async () => {
            vi.mocked(prisma.user.findUnique).mockResolvedValue({
                id: 1,
                email: 'test@example.com',
                password: 'hashed',
                role: 'USER',
            } as any);
            vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

            await expect(authService.login('test@example.com', 'wrongPassword', TEST_IP, TEST_USER_AGENT))
                .rejects.toThrow('INVALID_CREDENTIALS');

            expect(redis.set).not.toHaveBeenCalled();
            expect(prisma.loginAttempt.create).toHaveBeenCalledWith({
                data: {
                    userId: 1,
                    email: 'test@example.com',
                    success: false,
                    ip: TEST_IP,
                    userAgent: TEST_USER_AGENT,
                },
            });
        });

        it('возвращает токены, сохраняет refresh-токен и логирует успешную попытку при успешном логине', async () => {
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

            const result = await authService.login('test@example.com', 'correctPassword', TEST_IP, TEST_USER_AGENT);

            expect(result).toEqual({ accessToken: 'access-token', refreshToken: 'refresh-token' });
            expect(redis.set).toHaveBeenCalledWith(
                expect.stringMatching(/^refresh:[a-f0-9]{64}$/),
                expect.stringContaining('"userId":1'),
                'PX',
                expect.any(Number)
            );
            expect(prisma.loginAttempt.create).toHaveBeenCalledWith({
                data: {
                    userId: 1,
                    email: 'test@example.com',
                    success: true,
                    ip: TEST_IP,
                    userAgent: TEST_USER_AGENT,
                },
            });
        });

        it('не бросает ошибку наружу, если запись LoginAttempt не удалась', async () => {
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
            vi.mocked(prisma.loginAttempt.create).mockRejectedValue(new Error('DB down'));

            const result = await authService.login('test@example.com', 'correctPassword', TEST_IP, TEST_USER_AGENT);

            expect(result).toEqual({ accessToken: 'access-token', refreshToken: 'refresh-token' });
        });
    });

    describe('refresh', () => {
        it('бросает ошибку при невалидной подписи токена', async () => {
            vi.mocked(jwt.verify).mockImplementation(() => {
                throw new Error('invalid signature');
            });

            await expect(authService.refresh('bad-token'))
                .rejects.toThrow('INVALID_REFRESH_TOKEN');

            expect(redis.getdel).not.toHaveBeenCalled();
        });

        it('бросает ошибку, если refresh-токен уже был использован (не найден в Redis)', async () => {
            vi.mocked(jwt.verify).mockReturnValue({
                userId: 1,
                role: 'USER',
            } as any);

            vi.mocked(redis.getdel).mockResolvedValue(null);

            await expect(
                authService.refresh('valid-but-unknown-token')
            ).rejects.toThrow('INVALID_REFRESH_TOKEN');
        });

        it('бросает ошибку, если токен просрочен', async () => {
            vi.mocked(jwt.verify).mockReturnValue({
                userId: 1,
                role: 'USER',
            } as any);

            vi.mocked(redis.getdel).mockResolvedValue(JSON.stringify({
                userId: 1,
                role: 'USER',
                expiresAt: Date.now() - 1000,
            }));

            await expect(
                authService.refresh('expired-token')
            ).rejects.toThrow('INVALID_REFRESH_TOKEN');

            expect(prisma.user.findUnique).not.toHaveBeenCalled();
        });

        it('бросает ошибку, если пользователь не найден', async () => {
            vi.mocked(jwt.verify).mockReturnValue({
                userId: 1,
                role: 'USER',
            } as any);

            vi.mocked(redis.getdel).mockResolvedValue(JSON.stringify({
                userId: 1,
                role: 'USER',
                expiresAt: Date.now() + 60 * 60 * 1000,
            }));

            vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

            await expect(
                authService.refresh('valid-token')
            ).rejects.toThrow('INVALID_REFRESH_TOKEN');
        });

        it('ротирует токен и возвращает новую пару при успехе', async () => {
            vi.mocked(jwt.verify).mockReturnValue({
                userId: 1,
                role: 'USER',
            } as any);

            vi.mocked(redis.getdel).mockResolvedValue(JSON.stringify({
                userId: 1,
                role: 'USER',
                expiresAt: Date.now() + 60 * 60 * 1000,
            }));

            vi.mocked(prisma.user.findUnique).mockResolvedValue({
                id: 1,
                role: 'USER',
            } as any);

            vi.mocked(jwt.sign)
                .mockReturnValueOnce('new-access-token' as any)
                .mockReturnValueOnce('new-refresh-token' as any);

            const result = await authService.refresh('old-refresh-token');

            expect(redis.getdel).toHaveBeenCalledWith(expect.stringMatching(/^refresh:[a-f0-9]{64}$/));

            expect(redis.set).toHaveBeenCalledWith(
                expect.stringMatching(/^refresh:[a-f0-9]{64}$/),
                expect.stringContaining('"userId":1'),
                'PX',
                expect.any(Number)
            );

            expect(result).toEqual({
                accessToken: 'new-access-token',
                refreshToken: 'new-refresh-token',
            });
        });
    });

    describe('logout', () => {
        it('удаляет refresh-токен по значению токена', async () => {
            await authService.logout('some-refresh-token');

            expect(redis.del).toHaveBeenCalledWith(expect.stringMatching(/^refresh:[a-f0-9]{64}$/));
        });

        it('не бросает ошибку, если токена уже нет в Redis (идемпотентность)', async () => {
            vi.mocked(redis.del).mockResolvedValue(0 as any);

            await expect(authService.logout('already-deleted-token')).resolves.not.toThrow();
        });
    });
});