import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../../config/redis.config';
import { ClinicAdminInformation } from '../../accounts/entities/clinic-admin-information.entity';

@Injectable()
export class SeepayAuthGuard implements CanActivate {
  private readonly logger = new Logger(SeepayAuthGuard.name);
  private readonly SEPAY_PENDING_PREFIX = 'sepay:pending:';

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(ClinicAdminInformation)
    private readonly clinicAdminRepo: Repository<ClinicAdminInformation>,
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const body = request.body;
    const authHeader = request.headers['authorization'];

    let extractedKey: string | undefined;

    // 1. Extract from Authorization Header (Standard SePay Format: "Apikey <KEY>")
    if (authHeader && authHeader.startsWith('Apikey ')) {
      extractedKey = authHeader.replace('Apikey ', '').trim();
    }

    // 2. Fallback: Extract from Body Payload
    if (!extractedKey) {
      extractedKey = body?.apiKey;
    }

    this.logger.debug(`Extracted Key: [${extractedKey}]`);
    this.logger.debug(
      `Payload Info - subAccount: [${body?.subAccount}], accountNumber: [${body?.accountNumber}], content: [${body?.content}]`,
    );

    if (!extractedKey) {
      this.logger.error('Authentication Failed: Missing SePay API Key');
      throw new UnauthorizedException('Missing SePay API Key');
    }

    // ============================================================
    // 3. REDIS CHECK FIRST: Tìm pending SePay config trong Redis
    //    Ưu tiên kiểm tra Redis trước, nếu không có mới kiểm tra DB
    // ============================================================
    const contentTransactionId = this.extractTransactionIdFromContent(
      body?.content,
    );
    this.logger.debug(
      `Extracted transactionId from content: [${contentTransactionId}]`,
    );

    if (contentTransactionId) {
      const pendingData = await this.getPendingSepayConfig(
        contentTransactionId,
      );

      this.logger.debug(
        `Redis pending data for tx [${contentTransactionId}]: ${
          pendingData
            ? JSON.stringify({
                clinicId: pendingData.clinicId,
                bankName: pendingData.bankName,
                bankNumber: pendingData.bankNumber,
                seepayVA: pendingData.seepayVA,
                seepayKey: pendingData.seepayKey
                  ? `${pendingData.seepayKey.substring(0, 8)}...`
                  : 'N/A',
                transactionId: pendingData.transactionId,
              })
            : 'NULL (not found in Redis)'
        }`,
      );

      if (pendingData) {
        // So sánh seepayKey từ Redis với extractedKey từ Authorization header
        if (pendingData.seepayKey && pendingData.seepayKey === extractedKey) {
          this.logger.log(
            `✅ Authentication Successful via Redis pending SePay config (tx: ${contentTransactionId})`,
          );
          return true;
        } else {
          this.logger.warn(
            `Redis pending config found but seepayKey mismatch: Redis=[${
              pendingData.seepayKey
                ? pendingData.seepayKey.substring(0, 8) + '...'
                : 'N/A'
            }] vs Extracted=[${extractedKey ? extractedKey.substring(0, 8) + '...' : 'N/A'}]`,
          );
        }
      }
    }

    // ============================================================
    // 4. DATABASE CHECK: Verify Key matches VA or Bank Number in DB
    //    Chỉ chạy khi Redis không có data
    // ============================================================
    const seepayKey = body?.seepayKey;
    const vaNumber = body?.subAccount;
    const accNumber = body?.accountNumber;

    if (seepayKey) {
      this.logger.debug(
        `Direct key lookup requested using seepayKey in body. Comparing with extracted SePay key.`,
      );

      if (seepayKey !== extractedKey) {
        this.logger.error(
          'Authentication Failed: Provided seepayKey does not match the actual SePay API Key',
        );
        throw new UnauthorizedException('Invalid API Key for this account');
      } else {
        this.logger.log(`Authentication Successful for Seepay Change.`);
        return true;
      }
    } else if (vaNumber || accNumber) {
      this.logger.debug(
        `Searching DB for Key: [${extractedKey}] matching VA: [${vaNumber}] OR Bank: [${accNumber}]`,
      );

      const clinicAdmin = await this.clinicAdminRepo.findOne({
        where: [
          { sepayKey: extractedKey, sepayVa: vaNumber },
          { sepayKey: extractedKey, bankNumber: accNumber },
        ],
      });

      if (clinicAdmin) {
        this.logger.log(
          `Authentication Successful for Clinic: ${clinicAdmin.clinicName}`,
        );
        return true;
      } else {
        this.logger.warn(
          `No match found in DB for Key and provided account info`,
        );
      }
    } else {
      this.logger.warn(
        'No account identifiers (seepayKey/subAccount/accountNumber) found in request body',
      );
    }

    // 5. Global Fallback: Compare against system-wide SEEPAY_API_KEY (for Admin/System)
    const globalApiKey = this.configService.get<string>('seepay.apiKey');
    if (globalApiKey && extractedKey === globalApiKey) {
      this.logger.log('Authentication Successful via Global API Key');
      return true;
    }

    this.logger.error('Authentication Failed: Invalid API Key or VA mismatch');
    throw new UnauthorizedException('Invalid API Key for this account');
  }

  /**
   * Get pending SePay config from Redis
   */
  private async getPendingSepayConfig(
    transactionId: string,
  ): Promise<any | null> {
    try {
      const key = `${this.SEPAY_PENDING_PREFIX}${transactionId}`;
      this.logger.debug(`Reading Redis key: [${key}]`);
      const data = await this.redisClient.get(key);
      this.logger.debug(
        `Redis GET result: ${data ? 'FOUND (' + data.length + ' bytes)' : 'NOT FOUND'}`,
      );
      return data ? JSON.parse(data) : null;
    } catch (error) {
      this.logger.warn(
        `Failed to read pending SePay config from Redis: ${error}`,
      );
      return null;
    }
  }

  /**
   * Extract transaction ID from SePay callback content field
   * SePay sends the description (which is transactionId) in the content field
   * NOTE: SePay strips dashes from UUIDs, so "9017837f-dcd1-42b2-a038-b2aa43da09e2"
   *       becomes "9017837fdcd142b2a038b2aa43da09e2" in the content field.
   */
  private extractTransactionIdFromContent(
    content: string | undefined,
  ): string | null {
    if (!content) return null;

    // Try standard UUID with dashes first
    const dashedMatch = content.match(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    );
    if (dashedMatch) return dashedMatch[0];

    // Fallback: Match 32 consecutive hex chars (UUID without dashes from SePay)
    const noDashMatch = content.match(/([0-9a-f]{32})/i);
    if (noDashMatch) {
      const raw = noDashMatch[1];
      // Reconstruct dashed UUID format: 8-4-4-4-12
      const reconstructed = `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`;
      this.logger.debug(
        `Reconstructed UUID from SePay content: [${raw}] → [${reconstructed}]`,
      );
      return reconstructed;
    }

    return null;
  }
}
