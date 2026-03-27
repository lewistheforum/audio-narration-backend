import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { MESSAGES } from '../message';
import { formatToVietnamTime } from '../utils/date.util';

@Injectable()
export class ResponseTransformInterceptor<T> implements NestInterceptor {
  /**
   * Keep backwards compatibility for endpoints returning { message, data },
   * but do not drop metadata for richer payloads such as paginated objects.
   */
  private extractResponseData(payload: any): any {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return payload;
    }

    if (!Object.prototype.hasOwnProperty.call(payload, 'data')) {
      return payload;
    }

    const keys = Object.keys(payload);
    const isSimpleEnvelope = keys.every(
      (key) => key === 'data' || key === 'message',
    );

    return isSimpleEnvelope ? payload.data : payload;
  }

  /**
   * High-performance recursive date formatter.
   * Transforms both Date objects and ISO UTC strings to Vietnam timezone strings.
   */
  private fastFormatDates(data: any, depth = 0): any {
    if (depth > 10) return data;
    if (data === null || data === undefined) return data;

    const dataType = typeof data;

    if (data instanceof Date) {
      return formatToVietnamTime(data);
    }

    if (
      dataType === 'string' &&
      data.length >= 20 &&
      data.endsWith('Z') &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:/.test(data)
    ) {
      return formatToVietnamTime(data);
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.fastFormatDates(item, depth + 1));
    }

    if (dataType === 'object') {
      // Avoid recursing into system/complex instances like Buffers, Streams, or Socket objects
      if (
        data instanceof Buffer ||
        data.constructor?.name === 'Buffer' ||
        data.constructor?.name === 'Socket' ||
        data.constructor?.name === 'EventEmitter'
      ) {
        return data;
      }

      const formatted: any = {};
      for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          formatted[key] = this.fastFormatDates(data[key], depth + 1);
        }
      }
      return formatted;
    }

    return data;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse();

    return next.handle().pipe(
      map((data) => {
        const message = data?.message || MESSAGES.successMessage.index;
        const rawData = this.extractResponseData(data);
        
        // Use the fast formatter to ensure +07:00 strings
        const formattedData = this.fastFormatDates(rawData);
        
        return {
          statusCode: response.statusCode,
          message: message,
          data: formattedData,
        };
      }),
    );
  }
}
