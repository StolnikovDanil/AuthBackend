export interface LoginAttempt {
    userId: number | null;
    email: string;
    success: boolean;
    ip: string;
    userAgent?: string | null | undefined;
}


export interface LoginAttemptLite {
    userId: number | null;
    email: string;
    success: boolean;
    ip: string;
    userAgent: string | null;
    createdAt: Date;
};
