import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFound';
import { taskRouter } from './modules/tasks/task.routes';
import { ApiError } from './utils/ApiError';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      // A request with no Origin header (curl, same-origin, server-side fetch)
      // is allowed; browser requests must come from a configured origin.
      origin(origin, callback) {
        if (!origin || env.corsOrigins.includes(origin)) return callback(null, true);
        // An ApiError (rather than a bare Error) so the rejection is reported as
        // a 403 with the usual JSON shape instead of an opaque 500.
        return callback(new ApiError(403, 'CORS_FORBIDDEN', `Origin ${origin} is not allowed by CORS`));
      },
    }),
  );
  // A body cap keeps a runaway payload from being buffered into memory.
  app.use(express.json({ limit: '100kb' }));
  if (!env.isTest) {
    app.use(morgan(env.isProduction ? 'combined' : 'dev'));
  }

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
  });

  app.use('/api/tasks', taskRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
