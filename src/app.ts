import express from 'express';
import { createYoga, createSchema } from 'graphql-yoga';
import usersRouter from './routes/users.routes.js';
import { errorHandler } from "./middlewares/errorHandler.js";
import authRoutes from "./routes/auth.routes.js";
import insightsRouter from "./routes/insights.routes.js";
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from "helmet";
import { pinoHttp } from 'pino-http';
import { logger } from "./utils/logger.js";
import { allowedOrigins, registerLimit, loginLimit, refreshLimit, insightsLimit } from './constants/app.constants.js';
import { typeDefs } from './graphql/schema.js';
import { resolvers } from './graphql/resolvers.js';
import { createContext } from './graphql/context.js';

const app = express();

app.use(helmet());

app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));
app.use(pinoHttp({ logger }));

app.use(express.json());
app.use(cookieParser());

app.get('/', (_req, res) => {
    res.json({ message: 'Server is running' })
})

const yoga = createYoga({
    schema: createSchema({ typeDefs, resolvers }),
    context: createContext,
    graphqlEndpoint: '/graphql'
});

app.use('/graphql', yoga);

app.use('/auth/register', registerLimit);
app.use('/auth/login', loginLimit);
app.use('/auth/refresh', refreshLimit);
app.use('/auth', authRoutes);
app.use('/users', usersRouter);
app.use('/admin/insights', insightsLimit);
app.use('/admin/insights', insightsRouter);

app.use(errorHandler);

export default app;