import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

vi.mock('pino-http', () => ({
    pinoHttp: vi.fn(() => {
        return (_req: any, _res: any, next: any) => next();
    }),
}));

vi.mock('../src/prisma.js', () => ({
    prisma: {
        user: { findUnique: vi.fn() },
        refreshToken: { create: vi.fn(), findUnique: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
        loginAttempt: { create: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    },
}));

vi.mock('../src/utils/logger.js', () => {
    const mockLogger: Record<string, unknown> = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        fatal: vi.fn(),
        trace: vi.fn(),
        silent: vi.fn(),
    };
    // pino-http calls logger.child(...) internally to create a per-request logger.
    mockLogger.child = vi.fn(() => mockLogger);
    return { logger: mockLogger };
});

const ACCESS_SECRET = 'test-access-secret';

let app: typeof import('../src/app.js').default;

beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = ACCESS_SECRET;
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/testdb';

    app = (await import('../src/app.js')).default;
});

const signToken = (userId: number, role: string) =>
    jwt.sign({ userId, role }, ACCESS_SECRET, { expiresIn: '15m' });

describe('GET /admin/insights', () => {
    it('возвращает 401 без токена', async () => {
        const res = await request(app).get('/admin/insights');

        expect(res.status).toBe(401);
    });

    it('возвращает 401 с некорректным токеном', async () => {
        const res = await request(app)
            .get('/admin/insights')
            .set('Authorization', 'Bearer not-a-real-token');

        expect(res.status).toBe(401);
    });

    it('возвращает 403 для роли USER', async () => {
        const token = signToken(1, 'USER');

        const res = await request(app)
            .get('/admin/insights')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(403);
        expect(res.body).toEqual({ error: 'Недостаточно прав' });
    });

    it('возвращает 400 при некорректном query-параметре hours', async () => {
        const token = signToken(1, 'ADMIN');

        const res = await request(app)
            .get('/admin/insights?hours=abc')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(400);
    });
});