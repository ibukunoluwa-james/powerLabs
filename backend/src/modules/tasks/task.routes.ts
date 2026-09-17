import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import * as controller from './task.controller';
import {
  TASK_STATUSES,
  createTaskSchema,
  listTasksQuerySchema,
  taskIdParamsSchema,
  updateTaskSchema,
} from './task.schema';

export const taskRouter = Router();

// Lets the frontend render the status filter/select without hard-coding the
// enum in two places.
taskRouter.get('/meta', (_req, res) => {
  res.json({ data: { statuses: TASK_STATUSES } });
});

taskRouter.get(
  '/',
  validate({ query: listTasksQuerySchema }),
  asyncHandler(controller.listTasks),
);

taskRouter.post('/', validate({ body: createTaskSchema }), asyncHandler(controller.createTask));

taskRouter.get(
  '/:id',
  validate({ params: taskIdParamsSchema }),
  asyncHandler(controller.getTask),
);

// PATCH is the primary update verb (partial updates). PUT is mapped to the same
// handler so a client that expects PUT semantics still works; the body schema
// accepts a full object either way.
taskRouter.patch(
  '/:id',
  validate({ params: taskIdParamsSchema, body: updateTaskSchema }),
  asyncHandler(controller.updateTask),
);
taskRouter.put(
  '/:id',
  validate({ params: taskIdParamsSchema, body: updateTaskSchema }),
  asyncHandler(controller.updateTask),
);

taskRouter.delete(
  '/:id',
  validate({ params: taskIdParamsSchema }),
  asyncHandler(controller.deleteTask),
);
