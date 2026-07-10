import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../types/auth.js';
import { insightsQuerySchema } from '../schemas/insights.schema.js';
import { buildInsightsPayload } from '../services/insights.service.js';
import { generateInsightsSummary } from '../services/ai.service.js';
import { logger } from '../utils/logger.js';

export const getInsights = async (
    req: AuthRequest, res: Response, next: NextFunction
) => {
    const parsedQuery = insightsQuerySchema.safeParse(req.query);

    if (!parsedQuery.success) {
        return res.status(400).json({
            error: 'Ошибка валидации',
            details: parsedQuery.error.issues.map((issue) => ({
                field: issue.path.join('.'),
                message: issue.message
            }))
        });
    }

    try {
        const rawStats = await buildInsightsPayload(parsedQuery.data.hours);
        try {
            const {summary, riskFlags} = await generateInsightsSummary(rawStats);
            res.json({summary, riskFlags, rawStats});
        } catch (aiError) {
            logger.error({ err: aiError }, 'AI Insights: Gemini call failed, returning stats without summary');
            return res.json({
                summary: null,
                riskFlags: [],
                rawStats,
                aiError: 'Не удалось получить AI-саммари, попробуйте позже'
            });
        }
    } catch (error) {
        next(error);
    }
}