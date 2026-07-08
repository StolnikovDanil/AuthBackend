import type { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { AuthRequest} from "../types/auth.js";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET!;

export const requireAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Токен отсутствует' });
    }
    const token = authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Токен отсутствует' });
    }

    try {
        const payload = jwt.verify(token, ACCESS_SECRET) as unknown as { userId: number; role: string };
        req.userId = payload.userId;
        req.userRole = payload.role;
        next()
    }
    catch (error) {
        return res.status(401).json({ error: 'Неверный токен' });
    }
}