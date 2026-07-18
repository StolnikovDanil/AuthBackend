import { createPubSub } from 'graphql-yoga';
import type { Notification } from '../generated/prisma/client.js';

type PubSubEvents = {
    [key: `notificationAdded:${number}`]: [Notification];
};

export const pubsub = createPubSub<PubSubEvents>();

export const notificationTopic = (userId: number) => `notificationAdded:${userId}` as const;