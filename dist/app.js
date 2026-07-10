import express from 'express';
import usersRouter from './routes/users.routes.js';
import { errorHandler } from "./middlewares/errorHandler.js";
import authRoutes from "./routes/auth.routes.js";
import insightsRouter from "./routes/insights.routes.js";
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from "helmet";
import { pinoHttp } from 'pino-http';
import { logger } from "./utils/logger.js";
import { allowedOrigins, authLimit, insightsLimit } from './constants/app.constants.js';
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
    res.json({ message: 'Server is running' });
});
app.use('/auth/register', authLimit);
app.use('/auth/login', authLimit);
app.use('/auth/refresh', authLimit);
app.use('/auth/logout', authLimit);
app.use('/auth', authRoutes);
app.use('/users', usersRouter);
app.use('/admin/insights', insightsLimit);
app.use('/admin/insights', insightsRouter);
app.use(errorHandler);
export default app;
