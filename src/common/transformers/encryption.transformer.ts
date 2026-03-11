import { ValueTransformer } from 'typeorm';
import { encrypt, decrypt } from '../utils/encryption.util';
import { formatToVietnamTime, parseVietnamTime } from '../utils/date.util';

/**
 * TypeORM Encryption Transformer for String Columns
 *
 * Automatically encrypts data before saving to database
 * and decrypts data when reading from database
 *
 * Usage:
 * ```typescript
 * @Column({
 *   unique: true,
 *   transformer: encryptionTransformer
 * })
 * email: string;
 * ```
 *
 * Features:
 * - Transparent encryption/decryption
 * - Works with TypeORM column decorators
 * - Uses AES-256-GCM for secure encryption
 * - Handles null/undefined values gracefully
 */
export const encryptionTransformer: ValueTransformer = {
  /**
   * Transform data before saving to database (encrypt)
   *
   * @param value - Plain text value from entity
   * @returns {string} Encrypted value to store in database
   */
  to(value: string | null | undefined): string | null | undefined {
    if (value === null || value === undefined || value === '') {
      return value;
    }
    return encrypt(value);
  },

  /**
   * Transform data when reading from database (decrypt)
   *
   * @param value - Encrypted value from database
   * @returns {string} Decrypted plain text value
   */
  from(value: string | null | undefined): string | null | undefined {
    if (value === null || value === undefined || value === '') {
      return value;
    }
    try {
      return decrypt(value);
    } catch (error) {
      // If decryption fails (e.g. legacy data or invalid format), return null
      // This prevents the application from crashing for existing users
      // They will need to re-generate their keys
      console.warn(`EncryptionTransformer: Failed to decrypt value. It may be using legacy format or is corrupted. Resetting to null.`);
      return null;
    }
  },
};

/**
 * TypeORM Encryption Transformer for Date Columns
 *
 * Automatically encrypts Date values before saving to database
 * and decrypts them back to Date objects when reading from database
 *
 * Usage:
 * ```typescript
 * @Column({
 *   type: 'timestamp',
 *   transformer: dateEncryptionTransformer
 * })
 * appointmentDate: Date;
 * ```
 *
 * Features:
 * - Converts Date to ISO string before encryption
 * - Decrypts and parses back to Date object
 * - Works with TypeORM column decorators
 * - Uses AES-256-GCM for secure encryption
 * - Handles null/undefined values gracefully
 */
export const dateEncryptionTransformer: ValueTransformer = {
  /**
   * Transform data before saving to database (encrypt)
   *
   * @param value - Date value from entity
   * @returns {string} Encrypted ISO string to store in database
   */
  to(value: Date | null | undefined): any {
    if (value === null || value === undefined) {
      return value;
    }
    return encrypt(formatToVietnamTime(value));
  },

  /**
   * Transform data when reading from database (decrypt)
   *
   * @param value - Encrypted value from database
   * @returns {Date} Decrypted Date object
   */
  from(value: string | null | undefined): any {
    if (value === null || value === undefined || value === '') {
      return value;
    }
    const decrypted = decrypt(value);
    return parseVietnamTime(decrypted);
  },
};

/**
 * TypeORM Encryption Transformer for JSONB Columns
 *
 * Automatically encrypts JSON objects before saving to database
 * and decrypts them back to objects when reading from database
 *
 * Usage:
 * ```typescript
 * @Column({
 *   type: 'jsonb',
 *   transformer: jsonbEncryptionTransformer
 * })
 * metadata: Record<string, any>;
 * ```
 *
 * Features:
 * - Converts object to JSON string before encryption
 * - Decrypts and parses back to object
 * - Works with TypeORM column decorators
 * - Uses AES-256-GCM for secure encryption
 * - Handles null/undefined values gracefully
 */
export const jsonbEncryptionTransformer: ValueTransformer = {
  /**
   * Transform data before saving to database (encrypt)
   *
   * @param value - Object value from entity
   * @returns {string} Encrypted JSON string to store in database
   */
  to(value: Record<string, any> | null | undefined): any {
    if (value === null || value === undefined) {
      return value;
    }
    return encrypt(JSON.stringify(value));
  },

  /**
   * Transform data when reading from database (decrypt)
   *
   * @param value - Encrypted value from database
   * @returns {Record<string, any>} Decrypted object
   */
  from(value: string | null | undefined): any {
    if (value === null || value === undefined || value === '') {
      return value;
    }
    const decrypted = decrypt(value);
    return JSON.parse(decrypted);
  },
};
