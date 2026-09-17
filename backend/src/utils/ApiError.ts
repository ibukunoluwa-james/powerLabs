/**
 * An error that is safe to surface to the client. Anything thrown that is *not*
 * an ApiError is treated as an unexpected failure and reported as a generic 500.
 */
export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace?.(this, ApiError);
  }

  static badRequest(message: string, details?: unknown) {
    return new ApiError(400, 'BAD_REQUEST', message, details);
  }

  static notFound(message = 'Resource not found') {
    return new ApiError(404, 'NOT_FOUND', message);
  }

  static validation(message: string, details?: unknown) {
    return new ApiError(422, 'VALIDATION_ERROR', message, details);
  }
}
