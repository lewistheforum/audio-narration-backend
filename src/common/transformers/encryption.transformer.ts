import { ValueTransformer } from 'typeorm';
import { encrypt, decrypt } from '../utils/encryption.util';

/**
 * TypeORM Encryption Transformer
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
    return decrypt(value);
  },
};
