import type { Request, Response } from 'express';
import { validated } from '../../middleware/validate';
import type {
  CreateTaskInput,
  ListTasksQuery,
  TaskIdParams,
  UpdateTaskInput,
} from './task.schema';
import * as taskService from './task.service';

/** Controllers stay thin: read validated input, call the service, shape the response. */

export async function listTasks(req: Request, res: Response) {
  const query = validated<ListTasksQuery>(req, 'query');
  const { tasks, pagination } = await taskService.listTasks(query);
  res.status(200).json({ data: tasks, pagination });
}

export async function getTask(req: Request, res: Response) {
  const { id } = validated<TaskIdParams>(req, 'params');
  const task = await taskService.getTaskById(id);
  res.status(200).json({ data: task });
}

export async function createTask(req: Request, res: Response) {
  const input = validated<CreateTaskInput>(req, 'body');
  const task = await taskService.createTask(input);
  res.status(201).location(`/api/tasks/${task.id}`).json({ data: task });
}

export async function updateTask(req: Request, res: Response) {
  const { id } = validated<TaskIdParams>(req, 'params');
  const input = validated<UpdateTaskInput>(req, 'body');
  const task = await taskService.updateTask(id, input);
  res.status(200).json({ data: task });
}

export async function deleteTask(req: Request, res: Response) {
  const { id } = validated<TaskIdParams>(req, 'params');
  await taskService.deleteTask(id);
  // 204: the task is gone and there is nothing useful left to return.
  res.status(204).send();
}
