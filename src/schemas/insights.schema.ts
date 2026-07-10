import { z } from 'zod';

export const insightsQuerySchema = z.object({
    hours: z.coerce.number().int().min(1).max(720).default(24)
});

export type InsightsQuery = z.infer<typeof insightsQuerySchema>;