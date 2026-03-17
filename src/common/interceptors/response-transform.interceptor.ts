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
   * Recursively format all Date objects in the data to Vietnam timezone (+07:00)
   * Handles nested objects, arrays, and prevents circular references
   * 
   * @param data - Any data structure (object, array, primitive, Date, etc.)
   * @param visited - WeakSet to track visited objects and prevent infinite loops
   * @returns Data with all Date objects formatted to Vietnam timezone strings
   */
  private formatDates(data: any, visited = new WeakSet()): any {
    // Handle null explicitly (typeof null === 'object')
    if (data === null) {
      return null;
    }

    // Handle undefined
    if (data === undefined) {
      return undefined;
    }

    // Handle Date objects - convert to Vietnam timezone string
    if (data instanceof Date) {
      return formatToVietnamTime(data);
    }

    // Handle arrays
    if (Array.isArray(data)) {
      return data.map((item) => this.formatDates(item, visited));
    }

    // Handle plain objects
    if (typeof data === 'object') {
      // Prevent circular references
      if (visited.has(data)) {
        return data;
      }
      visited.add(data);

      // Create new object with formatted dates
      const formatted: any = {};
      for (const key in data) {
        if (data.hasOwnProperty(key)) {
          formatted[key] = this.formatDates(data[key], visited);
        }
      }
      return formatted;
    }

    // Handle primitives (string, number, boolean)
    return data;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    return next.handle().pipe(
      map((data) => {
        const message = data?.message || MESSAGES.successMessage.index;
        const rawData = this.extractResponseData(data);
        
        // Format all dates in the response data
        const formattedData = this.formatDates(rawData);
        
        return {
          statusCode: response.statusCode,
          message: message,
          data: formattedData,
        };
      }),
    );
  }
}
