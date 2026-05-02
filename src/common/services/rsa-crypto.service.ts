import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * RSA Crypto Service
 *
 * Provides asymmetric RSA-OAEP-SHA256 encryption/decryption utilities.
 *
 * Login endpoint: Pure RSA (client encrypts JSON with public key → server decrypts with private key)
 * Blog CUD endpoints: Hybrid RSA+AES-GCM (RSA wraps an AES-256-GCM session key)
 *
 * Keys are loaded from environment variables:
 *   RSA_PRIVATE_KEY — PKCS#8 PEM (may be stored with literal '\n' escape sequences)
 *   RSA_PUBLIC_KEY  — SPKI PEM (may be stored with literal '\n' escape sequences)
 */
@Injectable()
export class RsaCryptoService {
  private readonly privateKeyPem: string;
  private readonly publicKeyPem: string;

  constructor(private readonly configService: ConfigService) {
    const rawPrivate = this.configService.get<string>('RSA_PRIVATE_KEY');
    const rawPublic = this.configService.get<string>('RSA_PUBLIC_KEY');

    if (!rawPrivate || !rawPublic) {
      throw new Error(
        'RSA_PRIVATE_KEY and RSA_PUBLIC_KEY must be set in environment variables',
      );
    }

    // Normalize PEM: replace literal \n sequences and fix spacing between header/footer
    this.privateKeyPem = this.normalizePem(rawPrivate);
    this.publicKeyPem = this.normalizePem(rawPublic);
  }

  /**
   * Normalize a PEM string that may have been stored as a single line with spaces
   * or with literal `\n` escape sequences instead of real newlines.
   */
  private normalizePem(raw: string): string {
    // Replace literal \n escape sequences
    let pem = raw.replace(/\\n/g, '\n');

    // If still a single line (no real newlines), reconstruct proper PEM
    if (!pem.includes('\n')) {
      // Split on BEGIN/END markers and base64 body
      const begin = pem.match(/(-----BEGIN [^-]+-----)/)?.[1] ?? '';
      const end = pem.match(/(-----END [^-]+-----)/)?.[1] ?? '';
      const body = pem
        .replace(begin, '')
        .replace(end, '')
        .replace(/\s+/g, '');

      // Chunk body into 64-char lines (standard PEM format)
      const lines = body.match(/.{1,64}/g) ?? [];
      pem = [begin, ...lines, end, ''].join('\n');
    }

    return pem;
  }

  /**
   * Returns the RSA public key PEM string.
   * Used to expose the public key to clients via GET /auth/public-key.
   */
  getPublicKey(): string {
    return this.publicKeyPem;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Pure RSA  (Login)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Decrypt an RSA-OAEP-SHA256 encrypted base64 string using the private key.
   * Used for the login endpoint where payload is small enough for pure RSA.
   *
   * @param encryptedBase64 - Base64-encoded ciphertext produced by the client
   * @returns Decrypted plaintext string (JSON)
   * @throws BadRequestException if decryption fails (wrong key, tampered payload, etc.)
   */
  decryptWithPrivateKey(encryptedBase64: string): string {
    try {
      const buffer = Buffer.from(encryptedBase64, 'base64');
      const decrypted = crypto.privateDecrypt(
        {
          key: this.privateKeyPem,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256',
        },
        buffer,
      );
      return decrypted.toString('utf8');
    } catch (e) {
      console.error('RSA Decryption Error:', e);
      throw new BadRequestException(
        'Failed to decrypt payload. Ensure the request body is encrypted with the correct RSA public key.',
      );
    }
  }

  /**
   * Encrypt a plaintext string with the RSA public key (OAEP SHA-256).
   * Primarily used in tests / the client script.
   *
   * @param plaintext - UTF-8 string to encrypt
   * @returns Base64-encoded ciphertext
   */
  encryptWithPublicKey(plaintext: string): string {
    const buffer = Buffer.from(plaintext, 'utf8');
    const encrypted = crypto.publicEncrypt(
      {
        key: this.publicKeyPem,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      buffer,
    );
    return encrypted.toString('base64');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Hybrid RSA + AES-GCM  (Blog CUD)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Decrypt a hybrid-encrypted payload.
   *
   * The client:
   *   1. Generates a random AES-256-GCM key and 12-byte IV.
   *   2. AES-GCM encrypts the JSON body → encryptedData (base64) + authTag (last 16 bytes appended).
   *   3. RSA-OAEP-SHA256 encrypts the AES key → encryptedKey (base64).
   *
   * @param encryptedKey  - Base64 RSA-encrypted AES key
   * @param iv            - Base64 12-byte AES-GCM IV
   * @param encryptedData - Base64 AES-GCM ciphertext (ciphertext + 16-byte auth tag appended)
   * @returns Decrypted plaintext JSON string
   * @throws BadRequestException on any decryption failure
   */
  hybridDecrypt({
    encryptedKey,
    iv,
    encryptedData,
  }: {
    encryptedKey: string;
    iv: string;
    encryptedData: string;
  }): string {
    try {
      // Step 1: RSA-decrypt the AES session key
      const aesKey = crypto.privateDecrypt(
        {
          key: this.privateKeyPem,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256',
        },
        Buffer.from(encryptedKey, 'base64'),
      );

      // Step 2: AES-GCM decrypt — last 16 bytes of encryptedData are the auth tag
      const encBuf = Buffer.from(encryptedData, 'base64');
      const authTag = encBuf.slice(encBuf.length - 16);
      const ciphertext = encBuf.slice(0, encBuf.length - 16);
      const ivBuf = Buffer.from(iv, 'base64');

      const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, ivBuf);
      decipher.setAuthTag(authTag);

      const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]);

      return decrypted.toString('utf8');
    } catch (e) {
      console.error('Hybrid Decryption Error:', e);
      throw new BadRequestException(
        'Failed to decrypt hybrid payload. Ensure the request is encrypted with the correct RSA public key and AES-GCM.',
      );
    }
  }

  /**
   * Encrypt a plaintext string with hybrid RSA+AES-GCM.
   * Used in the client test script.
   *
   * @param plaintext - UTF-8 JSON string to encrypt
   * @returns { encryptedKey, iv, encryptedData } all base64-encoded
   */
  hybridEncrypt(plaintext: string): {
    encryptedKey: string;
    iv: string;
    encryptedData: string;
  } {
    // Generate random AES-256-GCM key and 12-byte IV
    const aesKey = crypto.randomBytes(32);
    const iv = crypto.randomBytes(12);

    const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag(); // 16 bytes

    // Append auth tag to ciphertext
    const encryptedData = Buffer.concat([ciphertext, authTag]);

    // RSA-encrypt the AES key
    const encryptedKey = crypto.publicEncrypt(
      {
        key: this.publicKeyPem,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      aesKey,
    );

    return {
      encryptedKey: encryptedKey.toString('base64'),
      iv: iv.toString('base64'),
      encryptedData: encryptedData.toString('base64'),
    };
  }
}
