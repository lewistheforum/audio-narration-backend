import { generateEncryptionKey } from '../utils/encryption.util';

/**
 * Generate Encryption Key Script
 * 
 * Generates a secure 256-bit (32-byte) encryption key for AES-256-GCM
 * 
 * Usage:
 * npx ts-node src/common/scripts/generate-encryption-key.ts
 * 
 * Then copy the output to your .env file:
 * ENCRYPTION_KEY=<generated-key>
 */

console.log('🔑 Generating AES-256 Encryption Key...\n');

const key = generateEncryptionKey();

console.log('✅ Key generated successfully!\n');
console.log('Add this to your .env file:');
console.log('━'.repeat(70));
console.log(`ENCRYPTION_KEY=${key}`);
console.log('━'.repeat(70));
console.log('\n⚠️  IMPORTANT:');
console.log('- Keep this key SECRET and SECURE');
console.log('- NEVER commit this key to version control');
console.log('- Use different keys for different environments');
console.log('- If you lose this key, encrypted data CANNOT be recovered');
console.log('- Store a backup of this key in a secure location\n');
