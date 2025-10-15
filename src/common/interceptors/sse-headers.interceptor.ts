import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Response } from 'express';

/**
 * Interceptor for SSE endpoints
 * NOTE: When using @Sse() decorator, NestJS automatically sets SSE headers.
 * This interceptor should NOT set headers - it only logs errors.
 * Setting headers manually will cause "Cannot set headers after they are sent" error.
 */
@Injectable()
export class SseHeadersInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const response = context.switchToHttp().getResponse<Response>();

    // Check if this is an SSE endpoint by looking at the handler metadata
    const handler = context.getHandler();
    const isSseEndpoint = Reflect.getMetadata('sse', handler);

    // DO NOT set headers here when using @Sse() decorator!
    // The @Sse() decorator automatically handles all SSE headers.
    // Attempting to set them here causes "Cannot set headers after they are sent" error.

    // Only set headers if NOT using @Sse() decorator AND headers haven't been sent yet
    if (!isSseEndpoint && !response.headersSent && context.getType() === 'http') {
      // This path should only be used for manual SSE implementations without @Sse()
      response.setHeader('Content-Type', 'text/event-stream');
      response.setHeader('Cache-Control', 'no-cache, no-transform');
      response.setHeader('Connection', 'keep-alive');
      response.setHeader('X-Accel-Buffering', 'no');
      response.setHeader('Content-Encoding', 'none');
    }

    return next.handle().pipe(
      tap({
        error: (err) => {
          // Log SSE errors for debugging
          if (isSseEndpoint) {
            console.error('SSE stream error:', err);
          }
        },
      }),
    );
  }
}
