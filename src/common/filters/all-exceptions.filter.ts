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
  success: false;
  error: {
    code: string;
    message: string;
    details: Record<string, unknown>;
  };
  timestamp: string;
  statusCode?: number;
  requestId?: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { id?: string }>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errorCode = 'INTERNAL_ERROR';
    let details: Record<string, unknown> = {};

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as {
          message?: string | string[];
          errorCode?: string;
          error?: string;
        };

        // Handle validation errors with array of messages
        if (Array.isArray(responseObj.message)) {
          message = responseObj.message.join(', ');
          details = { errors: responseObj.message };
        } else {
          message = responseObj.message || responseObj.error || message;
        }

        errorCode = responseObj.errorCode || this.getErrorCodeFromStatus(status);
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
      success: false,
      error: {
        code: errorCode,
        message,
        details,
      },
      timestamp: new Date().toISOString(),
      statusCode: status,
      requestId: request.id,
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

    // Don't leak stack traces in production, but include in details for dev
    if (process.env.NODE_ENV !== 'production' && exception instanceof Error) {
      errorResponse.error.details.stack = exception.stack;
    }

    response.status(status).json(errorResponse);
  }

  private getErrorCodeFromStatus(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return 'VALIDATION_ERROR';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'RATE_LIMIT_EXCEEDED';
      case HttpStatus.INTERNAL_SERVER_ERROR:
        return 'INTERNAL_ERROR';
      default:
        return 'UNKNOWN_ERROR';
    }
  }
}
