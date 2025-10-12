import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpStatus,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
  statusCode?: number;
  requestId?: string;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    return next.handle().pipe(
      map((data) => {
        // Skip transformation for SSE streams (Observable responses)
        if (data && typeof data === 'object' && 'pipe' in data) {
          return data;
        }

        const statusCode = response.statusCode || HttpStatus.OK;

        // If data is already wrapped (has success and data properties), return as-is
        if (data && typeof data === 'object' && 'success' in data && 'data' in data) {
          return data;
        }

        return {
          success: statusCode >= 200 && statusCode < 300,
          data,
          timestamp: new Date().toISOString(),
          statusCode,
          requestId: request.id,
        };
      }),
    );
  }
}
