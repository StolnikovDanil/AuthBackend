import jwt from 'jsonwebtoken';
const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
if (!ACCESS_SECRET) {
    throw new Error('JWT_ACCESS_SECRET must be set');
}
export const requireAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Токен отсутствует' });
    }
    const token = authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Токен отсутствует' });
    }
    try {
        const payload = jwt.verify(token, ACCESS_SECRET);
        req.userId = payload.userId;
        req.userRole = payload.role;
        next();
    }
    catch (error) {
        return res.status(401).json({ error: 'Неверный токен' });
    }
};
