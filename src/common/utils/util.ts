/**
 * Generate 6-digit Verification Code
 *
 * Utility function to generate random verification codes
 *
 * @returns 6-digit string code
 */
import * as crypto from 'crypto';

export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Generate RSA Key Pair
 * 
 * Utility function to generate public and private keys (RSA 2048-bit)
 * 
 * @returns { publicKey: string, privateKey: string }
 */
export function generateRSAKeyPair(): { publicKey: string; privateKey: string } {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  });

  return { publicKey, privateKey };
}
