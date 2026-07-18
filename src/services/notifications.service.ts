import { prisma } from '../prisma.js';
import { NotificationType } from '../generated/prisma/client.js';

export const checkNewDevice = async (
    userId: number,
    ip: string,
    userAgent?: string | null
): Promise<boolean> => {
    const history = await prisma.loginAttempt.findMany({
        where: {
            userId,
            success: true
        },
        select: { ip: true, userAgent: true }
    });

    const knownIps = new Set(history.map((a) => a.ip));
    const knownUserAgents = new Set(
        history.map((a) => a.userAgent).filter((ua): ua is string => Boolean(ua))
    );

    const ipIsNew = !knownIps.has(ip);
    const userAgentIsNew = Boolean(userAgent) && !knownUserAgents.has(userAgent!);

    return ipIsNew || userAgentIsNew;
};

export const createNotification = (
    userId: number,
    type: NotificationType,
    message: string
) => {
    return prisma.notification.create({
        data: { userId, type, message }
    });
};

export const getUserNotifications = (userId: number) => {
    return prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' }
    });
};

export const markAsRead = async (id: number, userId: number) => {
    const notification = await prisma.notification.findUnique({ where: { id } });

    if (!notification || notification.userId !== userId) {
        throw new Error('NOTIFICATION_NOT_FOUND');
    }

    return prisma.notification.update({
        where: { id },
        data: { read: true }
    });
};