import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

export interface ErrorResponse {
  statusCode: number;
  message: string;
  error: string;
  errorCode?: string;
  timestamp: string;
  path: string;
  requestId?: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errorCode = 'INTERNAL_ERROR';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        message = (exceptionResponse as any).message || message;
        errorCode = (exceptionResponse as any).errorCode || errorCode;
      }
    } else if (exception instanceof Error) {
      message = exception.message;

      // Map specific errors to appropriate status codes
      if (exception.name === 'UnauthorizedError') {
        status = HttpStatus.UNAUTHORIZED;
        errorCode = 'UNAUTHORIZED';
      } else if (exception.name === 'ValidationError') {
        status = HttpStatus.BAD_REQUEST;
        errorCode = 'VALIDATION_ERROR';
      } else if (exception.name === 'NotFoundError') {
        status = HttpStatus.NOT_FOUND;
        errorCode = 'NOT_FOUND';
      }
    }

    const errorResponse: ErrorResponse = {
      statusCode: status,
      message,
      error: HttpStatus[status] || 'Unknown Error',
      errorCode,
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId: (request as any).id,
    };

    // Log error details
    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} - ${status} - ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(`${request.method} ${request.url} - ${status} - ${message}`);
    }

    // Don't leak stack traces in production
    if (process.env.NODE_ENV !== 'production' && exception instanceof Error) {
      (errorResponse as any).stack = exception.stack;
    }

    response.status(status).json(errorResponse);
  }
}
