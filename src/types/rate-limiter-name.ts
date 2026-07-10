export type RateLimiterName = 'login' | 'register' | 'refresh' | 'insights';

export interface RateLimitEventPayload {
    limiter: RateLimiterName;
    resetAt: string;
    retryAfterMs: number;
}

