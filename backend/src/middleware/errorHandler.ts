import { Request, Response, NextFunction } from 'express';

/**
 * ============================================
 * ERROR HANDLER - Централизованная обработка ошибок
 * ============================================
 * 
 * Production-ready error handling middleware
 */

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
  details?: Record<string, unknown>;
}

export class ApiError extends Error implements AppError {
  statusCode: number;
  isOperational: boolean;
  details?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode: number = 500,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, details?: Record<string, unknown>) {
    return new ApiError(message, 400, details);
  }

  static notFound(message: string = 'Resource not found') {
    return new ApiError(message, 404);
  }

  static validation(errors: string[]) {
    return new ApiError('Validation failed', 400, { errors });
  }

  static internal(message: string = 'Internal server error') {
    return new ApiError(message, 500);
  }
}

/**
 * Async wrapper для controllers
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 404 handler
 */
export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  next(ApiError.notFound(`Route ${req.method} ${req.path} not found`));
};

/**
 * Global error handler
 */
export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';
  const isProduction = process.env.NODE_ENV === 'production';

  // Log error
  console.error(`[ERROR] ${req.method} ${req.path}:`, {
    message: err.message,
    statusCode,
    stack: isProduction ? undefined : err.stack,
  });

  // Send response
  res.status(statusCode).json({
    success: false,
    error: {
      message,
      code: statusCode,
      ...(err.details && { details: err.details }),
      ...(!isProduction && err.stack && { stack: err.stack }),
    },
    timestamp: new Date().toISOString(),
    path: req.path,
  });
};

/**
 * Validation middleware
 */
export const validateRequest = (
  schema: {
    body?: Record<string, unknown>;
    query?: Record<string, unknown>;
    params?: Record<string, unknown>;
  }
) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const errors: string[] = [];

    // Basic validation - can be extended with Zod/Joi
    if (schema.body && !req.body) {
      errors.push('Request body is required');
    }

    if (errors.length > 0) {
      return next(ApiError.validation(errors));
    }

    next();
  };
};

