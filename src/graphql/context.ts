import jwt from 'jsonwebtoken';
import type { YogaInitialContext } from 'graphql-yoga';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;

if (!ACCESS_SECRET) {
    throw new Error('JWT_ACCESS_SECRET must be set');
}

export type GraphQLContext = YogaInitialContext & {
    userId: number | null;
    userRole: string | null;
};

export const createContext = (initialContext: YogaInitialContext): GraphQLContext => {
    const authHeader = initialContext.request.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { ...initialContext, userId: null, userRole: null };
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
        return { ...initialContext, userId: null, userRole: null };
    }

    try {
        const payload = jwt.verify(token, ACCESS_SECRET) as { userId: number; role: string };
        return { ...initialContext, userId: payload.userId, userRole: payload.role };
    } catch {
        return { ...initialContext, userId: null, userRole: null };
    }
};