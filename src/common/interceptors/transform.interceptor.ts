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
  statusCode: number;
  message?: string;
  data: T;
  timestamp: string;
  requestId?: string;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    return next.handle().pipe(
      map((data) => ({
        statusCode: response.statusCode || HttpStatus.OK,
        message: data?.message || 'Success',
        data: data?.data !== undefined ? data.data : data,
        timestamp: new Date().toISOString(),
        requestId: request.id,
      })),
    );
  }
}

