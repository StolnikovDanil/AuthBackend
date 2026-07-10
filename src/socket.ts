import type { Server as HttpServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import { allowedOrigins } from './constants/app.constants.js';
import { logger } from './utils/logger.js';
import type { RateLimitEventPayload} from "./types/rate-limiter-name.js";

let io: SocketIOServer | undefined;

const rateLimitRoom = (ip: string): string => `rl:${ip}`;

export const initSocket = (httpServer: HttpServer): SocketIOServer => {
    io = new SocketIOServer(httpServer, {
        cors: {
            origin: allowedOrigins,
            credentials: true
        }
    })

    io.on('connection', (socket) => {
        const ip = socket.handshake.address;

        socket.join(rateLimitRoom(ip));

        logger.debug({ip, socketId: socket.id}, 'Socket connected');

        socket.on('disconnect', () => {
            logger.debug({ip, socketId: socket.id}, 'Socket disconnected');
        })

    })
    return io;
}

export const emitRateLimitEvent = (ip: string, payload: RateLimitEventPayload): void => {
    if (!io) {
        logger.warn({ ip, limiter: payload.limiter }, 'emitRateLimitEvent called before socket.io init');
        return;
    }

    io.to(rateLimitRoom(ip)).emit('rateLimited', payload);
};