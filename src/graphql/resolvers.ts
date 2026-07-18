import { GraphQLError } from 'graphql';
import * as notificationsService from '../services/notifications.service.js';
import { pubsub, notificationTopic } from './pubsub.js';
import type { GraphQLContext } from './context.js';

const requireAuth = (ctx: GraphQLContext): number => {
    if (!ctx.userId) {
        throw new GraphQLError('Unauthorized', { extensions: { code: 'UNAUTHENTICATED' } });
    }
    return ctx.userId;
};

export const resolvers = {
    Query: {
        notifications: (_: unknown, __: unknown, ctx: GraphQLContext) => {
            const userId = requireAuth(ctx);
            return notificationsService.getUserNotifications(userId);
        }
    },
    Mutation: {
        markNotificationRead: (_: unknown, args: { id: number }, ctx: GraphQLContext) => {
            const userId = requireAuth(ctx);
            return notificationsService.markAsRead(args.id, userId);
        }
    },
    Subscription: {
        notificationAdded: {
            subscribe: (_: unknown, __: unknown, ctx: GraphQLContext) => {
                const userId = requireAuth(ctx);
                return pubsub.subscribe(notificationTopic(userId));
            },
            resolve: (payload: unknown) => payload
        }
    }
};