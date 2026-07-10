import { logger } from '../utils/logger.js';
const GEMINI_MODEL = 'gemini-2.5-flash-lite';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const REQUEST_TIMEOUT_MS = 10_000;
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
const getApiKey = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not set');
    }
    return apiKey;
};
const isValidInsightsResult = (value) => {
    if (typeof value !== 'object' || value === null)
        return false;
    const candidate = value;
    return (typeof candidate.summary === 'string' &&
        Array.isArray(candidate.riskFlags) &&
        candidate.riskFlags.every((flag) => typeof flag === 'string'));
};
const stripMarkdownFence = (text) => {
    return text
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();
};
export const generateInsightsSummary = async (promptData) => {
    const apiKey = getApiKey();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let rawText;
    try {
        const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
                contents: [
                    {
                        role: 'user',
                        parts: [{ text: `${SYSTEM_INSTRUCTIONS}\n\nДанные:\n${JSON.stringify(promptData)}` }]
                    }
                ],
                generationConfig: {
                    responseMimeType: 'application/json',
                    temperature: 0.2
                }
            })
        });
        if (!response.ok) {
            const errorBody = await response.text().catch(() => '');
            throw new Error(`Gemini API responded with ${response.status}: ${errorBody}`);
        }
        const data = await response.json();
        rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (typeof rawText !== 'string' || rawText.length === 0) {
            throw new Error('Gemini API returned an empty response');
        }
    }
    catch (error) {
        clearTimeout(timeoutId);
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
            logger.error('Gemini API request timed out');
            throw new Error('AI_REQUEST_TIMEOUT');
        }
        logger.error({ error }, 'Gemini API request failed');
        throw new Error('AI_REQUEST_FAILED');
    }
    clearTimeout(timeoutId);
    try {
        const parser = JSON.parse(stripMarkdownFence(rawText));
        if (!isValidInsightsResult(parser)) {
            throw new Error('Invalid JSON response');
        }
        return parser;
    }
    catch (error) {
        logger.warn({ error, rawText }, 'Failed to parse Gemini response as JSON, falling back to raw text');
        return { summary: rawText, riskFlags: [] };
    }
};
