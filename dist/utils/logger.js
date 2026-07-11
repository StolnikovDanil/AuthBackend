import pino from 'pino';
const isDev = process.env.NODE_ENV !== 'production';
const SECRET_QUERY_PARAM_PATTERN = /([?&](?:key|token|secret|password|apikey|api_key|access_token)=)[^&\s"']+/gi;
export const maskSecretsInText = (value) => {
    if (typeof value !== 'string')
        return value;
    return value.replace(SECRET_QUERY_PARAM_PATTERN, '$1[REDACTED]');
};
const options = {
    level: process.env.LOG_LEVEL || 'info',
    serializers: {
        err: pino.stdSerializers.err
    },
    redact: {
        paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'res.headers["set-cookie"]',
            'err.message',
            'err.cause'
        ],
        censor: (value, path) => {
            const lastKey = path[path.length - 1];
            if (lastKey === 'message' || lastKey === 'cause') {
                return maskSecretsInText(value);
            }
            return '[REDACTED]';
        }
    }
};
if (isDev) {
    options.transport = {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:MM:ss' }
    };
}
export const logger = pino(options);
