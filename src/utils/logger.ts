import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

const options: pino.LoggerOptions = {
    level: process.env.LOG_LEVEL || 'info',
    redact: {
        paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'res.headers["set-cookie"]'
        ],
        censor: '[REDACTED]'
    }
};

if (isDev) {
    options.transport = {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:MM:ss' }
    };
}

export const logger = pino(options);