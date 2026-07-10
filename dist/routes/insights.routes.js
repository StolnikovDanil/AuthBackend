import { Router } from 'express';
import * as insightsController from '../controllers/insights.controller.js';
import { requireAuth } from '../middlewares/authMiddleware.js';
import { requireRole } from '../middlewares/requireRole.js';
const insightsRouter = Router();
insightsRouter.get('/', requireAuth, requireRole('ADMIN'), insightsController.getInsights);
export default insightsRouter;
