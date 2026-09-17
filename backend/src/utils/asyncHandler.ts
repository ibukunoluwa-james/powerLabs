import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Forwards rejected promises to the error middleware. Express 5 does this for
 * async handlers already, but wrapping keeps the intent explicit and keeps the
 * controllers working if the app is ever pinned back to Express 4.
 */
export function asyncHandler(handler: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
