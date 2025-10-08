import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { MESSAGES } from '../message';

@Injectable()
export class ResponseTransformInterceptor<T> implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    return next.handle().pipe(
  map((data) => {
    const message = data?.message || MESSAGES.successMessage.index;
    
      return {
        statusCode: response.statusCode,
        message: message,
        data: data?.data === undefined ? data : data.data,
          };
      }),
    );
  }
}