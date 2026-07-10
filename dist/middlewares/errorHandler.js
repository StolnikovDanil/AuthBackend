import { Prisma } from "../generated/prisma/client.js";
import { logger } from "../utils/logger.js";
export const errorHandler = (error, _req, res, _next) => {
    logger.error({ error }, 'Unhandled error');
    if (error instanceof Error) {
        switch (error.message) {
            case "INVALID_CREDENTIALS":
                return res.status(401).json({ error: 'Неверный email или пароль' });
            case "INVALID_REFRESH_TOKEN":
                return res.status(401).json({ error: 'Неверный или истёкший refresh-токен' });
        }
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        switch (error.code) {
            case "P2025":
                return res.status(404).json({ error: "Пользователь не найден" });
            case "P2002":
                return res.status(409).json({ error: "Такой email уже существует" });
            case "P2023":
                return res.status(400).json({ error: "Неверный формат данных" });
        }
    }
    return res.status(500).json({
        error: "Внутренняя ошибка сервера",
    });
};
