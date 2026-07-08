import { Router } from 'express';
import * as usersController from '../controllers/users.controller.js';
import { requireAuth } from "../middlewares/authMiddleware.js";
import { updateUserSchema } from '../schemas/users.schema.js';
import { validate } from '../middlewares/validate.js';
import { requireRole } from "../middlewares/requireRole.js";
import { requireSelfOrAdmin } from "../middlewares/requireSelfOrAdmin.js";

export const usersRouter = Router();

usersRouter.get('/', requireAuth, requireRole('ADMIN'), usersController.getUsers);
usersRouter.delete('/:id', requireAuth, requireRole('ADMIN'), usersController.deleteUser);
usersRouter.put('/:id', requireAuth, requireSelfOrAdmin, validate(updateUserSchema), usersController.updateUser);

export default usersRouter;