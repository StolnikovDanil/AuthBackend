import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../src/utils/logger.js', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

import { generateInsightsSummary } from '../src/services/ai.service.js';

const mockGeminiResponse = (text: string) => ({
    ok: true,
    json: async () => ({
        candidates: [{ content: { parts: [{ text }] } }],
    }),
});

describe('ai.service', () => {
    beforeEach(() => {
        process.env.GEMINI_API_KEY = 'test-key';
        vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        delete process.env.GEMINI_API_KEY;
    });

    it('бросает понятную ошибку, если GEMINI_API_KEY не задан', async () => {
        delete process.env.GEMINI_API_KEY;

        await expect(generateInsightsSummary({ totalAttempts: 1 })).rejects.toThrow('GEMINI_API_KEY is not set');
    });

    it('корректно парсит валидный JSON-ответ', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
            mockGeminiResponse(JSON.stringify({ summary: 'Всё спокойно', riskFlags: [] })) as any
        );

        const result = await generateInsightsSummary({ totalAttempts: 10 });

        expect(result).toEqual({ summary: 'Всё спокойно', riskFlags: [] });
    });

    it('снимает markdown-обёртку ```json ... ``` перед парсингом', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
            mockGeminiResponse('```json\n{"summary": "Есть риск", "riskFlags": ["brute-force"]}\n```') as any
        );

        const result = await generateInsightsSummary({ totalAttempts: 10 });

        expect(result).toEqual({ summary: 'Есть риск', riskFlags: ['brute-force'] });
    });

    it('фолбэкается на сырой текст, если ответ не валидный JSON', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(mockGeminiResponse('это не json, а просто текст') as any);

        const result = await generateInsightsSummary({ totalAttempts: 10 });

        expect(result).toEqual({ summary: 'это не json, а просто текст', riskFlags: [] });
    });

    it('фолбэкается, если JSON валидный, но форма не соответствует ожидаемой', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
            mockGeminiResponse(JSON.stringify({ foo: 'bar' })) as any
        );

        const result = await generateInsightsSummary({ totalAttempts: 10 });

        expect(result.riskFlags).toEqual([]);
        expect(result.summary).toContain('foo');
    });

    it('бросает AI_REQUEST_FAILED, если Gemini API вернул не-ok статус', async () => {
        vi.mocked(fetch).mockResolvedValueOnce({
            ok: false,
            status: 500,
            text: async () => 'internal error',
        } as any);

        await expect(generateInsightsSummary({ totalAttempts: 10 })).rejects.toThrow('AI_REQUEST_FAILED');
    });

    it('бросает AI_REQUEST_TIMEOUT при истечении таймаута', async () => {
        vi.mocked(fetch).mockImplementationOnce(() => {
            const abortError = new Error('The operation was aborted');
            abortError.name = 'AbortError';
            return Promise.reject(abortError);
        });

        await expect(generateInsightsSummary({ totalAttempts: 10 })).rejects.toThrow('AI_REQUEST_TIMEOUT');
    });

    it('не отправляет пустой промпт: данные попадают в тело запроса', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
            mockGeminiResponse(JSON.stringify({ summary: 'ok', riskFlags: [] })) as any
        );

        await generateInsightsSummary({ totalAttempts: 42, uniqueFailedIps: 3 });

        const [, requestInit] = vi.mocked(fetch).mock.calls[0]!;
        const body = JSON.parse((requestInit as RequestInit).body as string);
        const promptText = body.contents[0].parts[0].text;

        expect(promptText).toContain('42');
        expect(promptText).toContain('3');
    });

    it('передаёт ключ через заголовок x-goog-api-key, а не через query-параметр URL', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
            mockGeminiResponse(JSON.stringify({ summary: 'ok', riskFlags: [] })) as any
        );

        await generateInsightsSummary({ totalAttempts: 1 });

        const [url, requestInit] = vi.mocked(fetch).mock.calls[0]!;
        const headers = (requestInit as RequestInit).headers as Record<string, string>;


        expect(String(url)).not.toContain('test-key');
        expect(String(url)).not.toContain('key=');
        expect(headers['x-goog-api-key']).toBe('test-key');
    });
});