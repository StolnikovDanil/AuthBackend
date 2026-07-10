export interface InsightsResult {
    summary: string;
    riskFlags: string[];
}

export interface FailStreakEntry  {
    target: string;
    consecutiveFailures: number;
}

export interface InsightsPayload  {
    periodHours: number;
    totalAttempts: number;
    successCount: number;
    failedCount: number;
    uniqueFailedIps: number;
    topFailStreaks: FailStreakEntry[];
    newDeviceEventsCount: number;
    previousPeriod: {
        totalAttempts: number;
        changePercent: number | null;
    };
}