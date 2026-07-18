import { checkNewDevice, createNotification } from '../services/notifications.service.js';
import { NotificationType } from '../generated/prisma/client.js';
import { pubsub, notificationTopic } from '../graphql/pubsub.js';
import { logger } from '../utils/logger.js';

export const notifyIfNewDevice = async (
    userId: number,
    ip: string,
    userAgent?: string | null
): Promise<void> => {
    try {
        const isNewDevice = await checkNewDevice(userId, ip, userAgent);

        if (!isNewDevice) return;

        const notification = await createNotification(
            userId,
            NotificationType.NEW_DEVICE_LOGIN,
            `Вход с нового устройства (IP: ${ip})`
        );

        pubsub.publish(notificationTopic(userId), notification);

        logger.info({ userId, ip }, 'New device login detected, notification created');
    } catch (err) {
        logger.error({ err, userId, ip }, 'Failed to process new device notification');
    }
};