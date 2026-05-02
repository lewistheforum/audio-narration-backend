import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

/**
 * Encrypted Payload DTO (Pure RSA)
 *
 * Used for the login endpoint.
 * The client must encrypt the JSON body with the RSA public key (OAEP SHA-256)
 * and base64-encode the result before sending.
 *
 * Original body shape: { email, password, role }
 */
export class EncryptedPayloadDto {
  @ApiProperty({
    description:
      'Base64-encoded RSA-OAEP-SHA256 encrypted JSON string. ' +
      'Encrypt the original JSON body with the server RSA public key obtained from GET /auth/public-key.',
    example: 'base64-encoded-rsa-ciphertext...',
  })
  @IsNotEmpty({ message: 'encryptedData is required' })
  @IsString()
  encryptedData: string;
}

/**
 * Hybrid Encrypted Payload DTO (RSA + AES-GCM)
 *
 * Used for Blog CUD endpoints (POST /blogs, PATCH /blogs/:id).
 * The client must:
 *   1. Generate a random AES-256-GCM key and 12-byte IV.
 *   2. AES-GCM encrypt the JSON body; append the 16-byte auth tag to ciphertext.
 *   3. RSA-OAEP-SHA256 encrypt the AES key with the server public key.
 *
 * Original body shape: CreateBlogDto | UpdateBlogDto
 */
export class HybridEncryptedPayloadDto {
  @ApiProperty({
    description:
      'Base64-encoded RSA-OAEP-SHA256 encrypted AES-256-GCM session key.',
    example: 'base64-encoded-rsa-encrypted-aes-key...',
  })
  @IsNotEmpty({ message: 'encryptedKey is required' })
  @IsString()
  encryptedKey: string;

  @ApiProperty({
    description: 'Base64-encoded 12-byte AES-GCM initialization vector (IV).',
    example: 'base64-encoded-iv...',
  })
  @IsNotEmpty({ message: 'iv is required' })
  @IsString()
  iv: string;

  @ApiProperty({
    description:
      'Base64-encoded AES-GCM ciphertext with the 16-byte auth tag appended at the end.',
    example: 'base64-encoded-ciphertext+authtag...',
  })
  @IsNotEmpty({ message: 'encryptedData is required' })
  @IsString()
  encryptedData: string;
}
