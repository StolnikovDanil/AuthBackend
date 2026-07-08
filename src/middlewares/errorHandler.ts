import type { Request, Response, NextFunction } from "express";
import { Prisma } from "../generated/prisma/client.js";
import {logger} from "../utils/logger.js";

export const errorHandler = (
    error: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction
) => {
    logger.error({ error }, 'Unhandled error');


    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        switch (error.code) {
            case "P2025":
                return res.status(404).json({ error: "Пользователь не найден" });

            case "P2002":
                return res.status(409).json({ error: "Такой email уже существует" });

            case "P2023":
                return res.status(400).json({ error: "Неверный формат данных" });
            case "INVALID_CREDENTIALS":
                return res.status(401).json({ error: 'Неверный email или пароль' });

        }
    }

    return res.status(500).json({
        error: "Внутренняя ошибка сервера",
    });
};