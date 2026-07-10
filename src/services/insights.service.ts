import crypto from 'node:crypto';
import { prisma } from '../prisma.js';
import {DEFAULT_PERIOD_HOURS} from "../constants/app.constants.js";
import type {LoginAttemptLite} from "../types/login-attempt.js";
import type { FailStreakEntry, InsightsPayload } from "../types/insights.js";

const hashEmail = (email: string): string => {
    return crypto.createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 10);
}

const targetIdFor = (
    attempt: Pick<LoginAttemptLite, 'userId' | 'email'>
): string => {
    return attempt.userId !== null ? `user-${attempt.userId}` : hashEmail(attempt.email);
}


const computeTopFailStreaks = (attemptsAsc: LoginAttemptLite[], limit = 5): FailStreakEntry[] => {
    const byTarget = new Map<string, LoginAttemptLite[]>();

    for (const attempt of attemptsAsc) {
        const target = targetIdFor(attempt);
        const list = byTarget.get(target) ?? [];
        list.push(attempt);
        byTarget.set(target, list);
    }

    const streaks: FailStreakEntry[] = [];

    for (const [target, attempts] of byTarget) {
        let streak = 0;
        for (let i = attempts.length - 1; i >= 0; i--) {
            const attempt = attempts[i];

            if (!attempt) continue;

            if (attempt.success) break;

            streak++;
        }
        if (streak > 0) {
            streaks.push({ target, consecutiveFailures: streak });
        }
    }

    return streaks
        .sort((a, b) => b.consecutiveFailures - a.consecutiveFailures)
        .slice(0, limit);
};

const countNewDeviceEvents = async (periodAttempts: LoginAttemptLite[], periodStart: Date): Promise<number> => {
    const successfulWithUser = periodAttempts.filter((a) => a.success && a.userId !== null);
    if (successfulWithUser.length === 0) return 0;

    const userIds = [...new Set(successfulWithUser.map((a) => a.userId as number))];

    const history = await prisma.loginAttempt.findMany({
        where: {
            userId: { in: userIds },
            success: true,
            createdAt: { lt: periodStart }
        },
        select: { userId: true, ip: true, userAgent: true }
    });

    const knownByUser = new Map<number, { ips: Set<string>; userAgents: Set<string> }>();
    for (const record of history) {
        const key = record.userId as number;
        const entry = knownByUser.get(key) ?? { ips: new Set(), userAgents: new Set() };
        entry.ips.add(record.ip);
        if (record.userAgent) entry.userAgents.add(record.userAgent);
        knownByUser.set(key, entry);
    }

    let newDeviceCount = 0;
    for (const attempt of successfulWithUser) {
        const known = knownByUser.get(attempt.userId as number);
        const ipIsNew = !known || !known.ips.has(attempt.ip);
        const userAgentIsNew = Boolean(attempt.userAgent) && (!known || !known.userAgents.has(attempt.userAgent!));
        if (ipIsNew || userAgentIsNew) newDeviceCount++;
    }

    return newDeviceCount;
};

export const buildInsightsPayload = async (
    periodHours: number = DEFAULT_PERIOD_HOURS
): Promise<InsightsPayload> => {
    if (!Number.isFinite(periodHours) || periodHours <= 0) {
        throw new Error('periodHours must be a positive number');
    }

    const now = new Date();
    const periodMs = periodHours * 60 * 60 * 1000;
    const periodStart = new Date(now.getTime() - periodMs);
    const previousPeriodStart = new Date(periodStart.getTime() - periodMs);

    const [periodAttempts, previousPeriodCount] = await Promise.all([
        prisma.loginAttempt.findMany({
            where: { createdAt: { gte: periodStart } },
            select: { userId: true, email: true, success: true, ip: true, userAgent: true, createdAt: true },
            orderBy: { createdAt: 'asc' }
        }),
        prisma.loginAttempt.count({
            where: { createdAt: { gte: previousPeriodStart, lt: periodStart } }
        })
    ]);

    const totalAttempts = periodAttempts.length;
    const successCount = periodAttempts.filter((a) => a.success).length;
    const failedCount = totalAttempts - successCount;
    const uniqueFailedIps = new Set(periodAttempts.filter((a) => !a.success).map((a) => a.ip)).size;

    const topFailStreaks = computeTopFailStreaks(periodAttempts);
    const newDeviceEventsCount = await countNewDeviceEvents(periodAttempts, periodStart);

    const changePercent =
        previousPeriodCount === 0
            ? null
            : Math.round(((totalAttempts - previousPeriodCount) / previousPeriodCount) * 100);

    return {
        periodHours,
        totalAttempts,
        successCount,
        failedCount,
        uniqueFailedIps,
        topFailStreaks,
        newDeviceEventsCount,
        previousPeriod: {
            totalAttempts: previousPeriodCount,
            changePercent
        }
    };
};