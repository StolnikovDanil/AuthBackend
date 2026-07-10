import { logger } from '../utils/logger.js';
import {RETRYABLE_STATUS_CODES, MAX_RETRIES, BASE_RETRY_DELAY_MS} from "../constants/app.constants.js";

const GEMINI_MODEL = 'gemini-flash-latest';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const REQUEST_TIMEOUT_MS = 10_000;

export type InsightsResult = {
    summary: string;
    riskFlags: string[];
};

const SYSTEM_INSTRUCTIONS = `Ты - security-аналитик, который анализирует агрегированную,
обезличенную статистику попыток входа в систему (без email-адресов, паролей и токенов -
только числа, страны, временные окна и count по User-Agent). Твоя задача - кратко
резюмировать ситуацию на человеческом языке и выделить риск-флаги, если они есть
(например: аномальный всплеск неуспешных попыток, новый User-Agent/IP для активного
пользователя, признаки перебора паролей).

Отвечай СТРОГО в формате JSON, без markdown-обёртки (без \`\`\`), без преамбулы,
только сам JSON-объект следующей формы:
{
  "summary": "краткое текстовое резюме на русском языке, 2-4 предложения",
  "riskFlags": ["короткая формулировка риска 1", "короткая формулировка риска 2"]
}

Если рисков не обнаружено, верни "riskFlags": [].`;


const getApiKey = (): string => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not set');
    }
    return apiKey;
};

const isValidInsightsResult = (value: unknown): value is InsightsResult => {
    if (typeof value !== 'object' || value === null) return false;
    const candidate = value as Record<string, unknown>;
    return (
        typeof candidate.summary === 'string' &&
        Array.isArray(candidate.riskFlags) &&
        candidate.riskFlags.every((flag) => typeof flag === 'string')
    );
};


const stripMarkdownFence = (text: string): string => {
    return text
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();
};

const logAvailableModelsIfDev = async (apiKey: string): Promise<void> => {
    if (process.env.NODE_ENV !== 'development') return;

    try {
        const checkRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
        );
        const checkData = await checkRes.json();
        const availableModels = checkData?.models?.map((m: { name: string }) => m.name);
        logger.debug({ availableModels }, 'Available Gemini models');
    } catch (err) {
        logger.warn({ err }, 'Failed to list available Gemini models');
    }
};



const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const callGeminiOnce = async (apiKey: string, promptData: object): Promise<string> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        const response = await fetch(GEMINI_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey
            },
            signal: controller.signal,
            body: JSON.stringify({
                system_instruction: {
                    parts: [{ text: SYSTEM_INSTRUCTIONS }]
                },
                contents: [
                    {
                        role: 'user',
                        parts: [{ text: `Данные для анализа:\n${JSON.stringify(promptData)}` }]
                    }
                ],
                generation_config: {
                    response_mime_type: 'application/json',
                    temperature: 0.2
                }
            })
        });

        if (!response.ok) {
            const errorBody = await response.text().catch(() => '');
            const err = new Error(`Gemini API responded with ${response.status}: ${errorBody}`) as Error & { status?: number };
            err.status = response.status;
            throw err;
        }

        const data = await response.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (typeof rawText !== 'string' || rawText.length === 0) {
            throw new Error('Gemini API returned an empty response');
        }

        return rawText;
    } finally {
        clearTimeout(timeoutId);
    }
};

export const generateInsightsSummary = async (promptData: object): Promise<InsightsResult> => {
    const apiKey = getApiKey();

    await logAvailableModelsIfDev(apiKey);

    let rawText!: string;
    let lastErr: unknown;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            rawText = await callGeminiOnce(apiKey, promptData);
            lastErr = undefined;
            break;
        } catch (err) {
            lastErr = err;
            const status = (err as { status?: number })?.status;
            const isAbort = err instanceof Error && err.name === 'AbortError';
            const isRetryable = !isAbort && status !== undefined && RETRYABLE_STATUS_CODES.has(status);

            if (!isRetryable || attempt === MAX_RETRIES) {
                break;
            }

            const delay = BASE_RETRY_DELAY_MS * 2 ** attempt;
            logger.warn({ status, attempt: attempt + 1, delay }, 'Gemini API transient error, retrying');
            await sleep(delay);
        }
    }

    if (lastErr !== undefined) {
        if (lastErr instanceof Error && lastErr.name === 'AbortError') {
            logger.error('Gemini API request timed out');
            throw new Error('AI_REQUEST_TIMEOUT');
        }
        logger.error({ err: lastErr }, 'Gemini API request failed');
        throw new Error('AI_REQUEST_FAILED');
    }

    try {
        const parsed = JSON.parse(stripMarkdownFence(rawText));
        if (!isValidInsightsResult(parsed)) {
            throw new Error('Response shape does not match expected InsightsResult');
        }
        return parsed;
    } catch (err) {
        logger.warn({ err, rawText }, 'Failed to parse Gemini response as JSON, falling back to raw text');
        return { summary: rawText, riskFlags: [] };
    }
};