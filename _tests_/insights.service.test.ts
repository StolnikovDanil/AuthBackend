import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

vi.mock('../src/prisma.js', () => ({
    prisma: {
        loginAttempt: {
            findMany: vi.fn(),
            count: vi.fn(),
        },
    },
}));

import { prisma } from '../src/prisma.js';
import { buildInsightsPayload } from '../src/services/insights.service.js';

const NOW = new Date('2026-07-09T12:00:00.000Z');

const attempt = (overrides: Partial<{
    userId: number | null;
    email: string;
    success: boolean;
    ip: string;
    userAgent: string | null;
    createdAt: Date;
}>) => ({
    userId: null,
    email: 'user@example.com',
    success: true,
    ip: '1.1.1.1',
    userAgent: 'test-agent',
    createdAt: NOW,
    ...overrides,
});

beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
});

beforeEach(() => {
    vi.clearAllMocks();
});

describe('insights.service', () => {
    describe('buildInsightsPayload', () => {
        it('бросает ошибку при некорректном periodHours', async () => {
            await expect(buildInsightsPayload(0)).rejects.toThrow('periodHours must be a positive number');
            await expect(buildInsightsPayload(-5)).rejects.toThrow('periodHours must be a positive number');
        });

        it('считает totalAttempts, successCount, failedCount и uniqueFailedIps', async () => {
            vi.mocked(prisma.loginAttempt.findMany).mockResolvedValueOnce([
                attempt({ success: true, ip: '1.1.1.1' }),
                attempt({ success: false, ip: '2.2.2.2' }),
                attempt({ success: false, ip: '2.2.2.2' }),
                attempt({ success: false, ip: '3.3.3.3' }),
            ] as any);
            vi.mocked(prisma.loginAttempt.count).mockResolvedValueOnce(0);

            const result = await buildInsightsPayload(24);

            expect(result.totalAttempts).toBe(4);
            expect(result.successCount).toBe(1);
            expect(result.failedCount).toBe(3);
            // 2.2.2.2 встречается дважды среди неуспешных, но должен считаться один раз
            expect(result.uniqueFailedIps).toBe(2);
        });

        it('считает trailing-серию подряд неуспешных попыток по одному аккаунту', async () => {
            vi.mocked(prisma.loginAttempt.findMany).mockResolvedValueOnce([
                attempt({ userId: 1, email: 'a@example.com', success: true, createdAt: new Date('2026-07-09T10:00:00Z') }),
                attempt({ userId: 1, email: 'a@example.com', success: false, createdAt: new Date('2026-07-09T10:05:00Z') }),
                attempt({ userId: 1, email: 'a@example.com', success: false, createdAt: new Date('2026-07-09T10:10:00Z') }),
                attempt({ userId: 1, email: 'a@example.com', success: false, createdAt: new Date('2026-07-09T10:15:00Z') }),
            ] as any);
            vi.mocked(prisma.loginAttempt.count).mockResolvedValueOnce(0);

            const result = await buildInsightsPayload(24);

            expect(result.topFailStreaks).toEqual([
                { target: 'user_1', consecutiveFailures: 3 },
            ]);
        });

        it('обнуляет серию после успешной попытки в конце', async () => {
            vi.mocked(prisma.loginAttempt.findMany).mockResolvedValueOnce([
                attempt({ userId: 1, success: false, createdAt: new Date('2026-07-09T10:00:00Z') }),
                attempt({ userId: 1, success: false, createdAt: new Date('2026-07-09T10:05:00Z') }),
                attempt({ userId: 1, success: true, createdAt: new Date('2026-07-09T10:10:00Z') }),
            ] as any);
            vi.mocked(prisma.loginAttempt.count).mockResolvedValueOnce(0);

            const result = await buildInsightsPayload(24);

            expect(result.topFailStreaks).toEqual([]);
        });

        it('группирует незарегистрированные email по хешу, а не по адресу в открытом виде', async () => {
            vi.mocked(prisma.loginAttempt.findMany).mockResolvedValueOnce([
                attempt({ userId: null, email: 'ghost@example.com', success: false, createdAt: new Date('2026-07-09T10:00:00Z') }),
                attempt({ userId: null, email: 'ghost@example.com', success: false, createdAt: new Date('2026-07-09T10:05:00Z') }),
            ] as any);
            vi.mocked(prisma.loginAttempt.count).mockResolvedValueOnce(0);

            const result = await buildInsightsPayload(24);

            expect(result.topFailStreaks).toHaveLength(1);
            expect(result.topFailStreaks[0]!.target).toMatch(/^hash_[0-9a-f]{10}$/);
            expect(result.topFailStreaks[0]!.target).not.toContain('ghost');
            expect(result.topFailStreaks[0]!.consecutiveFailures).toBe(2);
        });

        it('считает changePercent относительно предыдущего периода', async () => {
            vi.mocked(prisma.loginAttempt.findMany).mockResolvedValueOnce([
                attempt({}), attempt({}), attempt({}), attempt({}),
            ] as any);
            vi.mocked(prisma.loginAttempt.count).mockResolvedValueOnce(2);

            const result = await buildInsightsPayload(24);

            expect(result.previousPeriod).toEqual({ totalAttempts: 2, changePercent: 100 });
        });

        it('возвращает changePercent: null, если в предыдущем периоде не было попыток', async () => {
            vi.mocked(prisma.loginAttempt.findMany).mockResolvedValueOnce([attempt({})] as any);
            vi.mocked(prisma.loginAttempt.count).mockResolvedValueOnce(0);

            const result = await buildInsightsPayload(24);

            expect(result.previousPeriod).toEqual({ totalAttempts: 0, changePercent: null });
        });

        it('считает newDeviceEventsCount для успешного входа с новым IP', async () => {
            vi.mocked(prisma.loginAttempt.findMany)
                .mockResolvedValueOnce([
                    attempt({ userId: 5, success: true, ip: '9.9.9.9', userAgent: 'chrome' }),
                ] as any)
                .mockResolvedValueOnce([
                    { userId: 5, ip: '1.1.1.1', userAgent: 'chrome' },
                ] as any);
            vi.mocked(prisma.loginAttempt.count).mockResolvedValueOnce(0);

            const result = await buildInsightsPayload(24);

            expect(result.newDeviceEventsCount).toBe(1);
        });

        it('не считает known device как новый', async () => {
            vi.mocked(prisma.loginAttempt.findMany)
                .mockResolvedValueOnce([
                    attempt({ userId: 5, success: true, ip: '1.1.1.1', userAgent: 'chrome' }),
                ] as any)
                .mockResolvedValueOnce([
                    { userId: 5, ip: '1.1.1.1', userAgent: 'chrome' },
                ] as any);
            vi.mocked(prisma.loginAttempt.count).mockResolvedValueOnce(0);

            const result = await buildInsightsPayload(24);

            expect(result.newDeviceEventsCount).toBe(0);
        });
    });
});