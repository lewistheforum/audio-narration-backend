import { ValueTransformer } from 'typeorm';
import { formatToDateOnly, parseVietnamTime } from '../utils/date.util';

/**
 * TypeORM ValueTransformer cho cột PostgreSQL DATE.
 *
 * VẤN ĐỀ: Khi Entity có `appointmentDate: Date`, TypeORM tự động convert
 * JS Date → UTC trước khi gửi tới PostgreSQL. Với timezone GMT+7,
 * "2026-04-02T00:00:00+07:00" bị chuyển thành "2026-04-01T17:00:00Z",
 * khiến cột DATE lưu sai ngày "2026-04-01".
 *
 * GIẢI PHÁP: Transformer chặn quá trình này, đảm bảo ngày được gửi
 * dưới dạng string "YYYY-MM-DD" nguyên vẹn theo giờ Việt Nam.
 */
export const dateOnlyTransformer: ValueTransformer = {
  /**
   * Entity → Database: Chuyển Date thành string "YYYY-MM-DD"
   * theo timezone Asia/Ho_Chi_Minh, tránh UTC shift.
   */
  to(value: Date | null | undefined): any {
    if (value === null || value === undefined) {
      return value;
    }
    return formatToDateOnly(value);
  },

  /**
   * Database → Entity: Chuyển string "YYYY-MM-DD" từ Postgres DATE
   * thành Date object đúng giờ địa phương (00:00:00 GMT+7).
   */
  from(value: string | null | undefined): any {
    if (value === null || value === undefined || value === '') {
      return value;
    }
    return parseVietnamTime(value);
  },
};
