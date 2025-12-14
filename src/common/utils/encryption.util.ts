import * as crypto from 'crypto';

/**
 * Encryption Utility
 * 
 * Provides symmetric encryption/decryption using AES-256-GCM
 * Designed for encrypting sensitive data like email addresses
 * 
 * Features:
 * - AES-256-GCM encryption for authenticated encryption
 * - Random IV generation for each encryption
 * - Authentication tag for data integrity verification
 * - Base64 encoding for database storage
 * 
 * Environment Variables Required:
 * - ENCRYPTION_KEY: 32-byte (256-bit) hex string for AES-256
 * 
 * Format: iv:authTag:encryptedData (all base64 encoded)
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits

/**
 * Get encryption key from environment variable
 * Key must be a 32-byte hex string (64 hex characters)
 * 
 * @throws {Error} If ENCRYPTION_KEY is not defined or invalid
 * @returns {Buffer} The encryption key as a buffer
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not defined');
  }

  // Convert hex string to buffer
  const keyBuffer = Buffer.from(key, 'hex');
  
  if (keyBuffer.length !== KEY_LENGTH) {
    throw new Error(
      `ENCRYPTION_KEY must be ${KEY_LENGTH} bytes (${KEY_LENGTH * 2} hex characters). Current length: ${keyBuffer.length} bytes`,
    );
  }

  return keyBuffer;
}

/**
 * Encrypt a plain text string using AES-256-GCM
 * 
 * @param plainText - The text to encrypt
 * @returns {string} Base64 encoded string in format: iv:authTag:encryptedData
 * @throws {Error} If encryption fails or key is invalid
 * 
 * @example
 * const encrypted = encrypt('user@example.com');
 * // Returns: "Cm5vbmNl:YXV0aFRhZw==:ZW5jcnlwdGVkRGF0YQ=="
 */
export function encrypt(plainText: string): string {
  if (!plainText) {
    return plainText;
  }

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(plainText, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    const authTag = cipher.getAuthTag();
    
    // Format: iv:authTag:encryptedData
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
  } catch (error) {
    throw new Error(
      `Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

/**
 * Decrypt an encrypted string using AES-256-GCM
 * 
 * @param encryptedText - The encrypted text in format: iv:authTag:encryptedData
 * @returns {string} The decrypted plain text
 * @throws {Error} If decryption fails, data is corrupted, or format is invalid
 * 
 * @example
 * const decrypted = decrypt('Cm5vbmNl:YXV0aFRhZw==:ZW5jcnlwdGVkRGF0YQ==');
 * // Returns: "user@example.com"
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) {
    return encryptedText;
  }

  try {
    const parts = encryptedText.split(':');
    
    if (parts.length !== 3) {
      throw new Error(
        'Invalid encrypted data format. Expected format: iv:authTag:encryptedData',
      );
    }

    const [ivBase64, authTagBase64, encrypted] = parts;
    
    const key = getEncryptionKey();
    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    throw new Error(
      `Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

/**
 * Generate a random encryption key for AES-256
 * Use this to generate a new ENCRYPTION_KEY for your .env file
 * 
 * @returns {string} 64 character hex string (32 bytes)
 * 
 * @example
 * const key = generateEncryptionKey();
 * console.log(`ENCRYPTION_KEY=${key}`);
 * // Output: ENCRYPTION_KEY=a1b2c3d4e5f6...
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString('hex');
}
