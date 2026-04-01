import {
  Inject,
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import Redis from 'ioredis';
import { AccountsService } from '../../modules/accounts/accounts.service';
import { AccountRole } from '../../modules/accounts/enums';
import { LegalDocumentVerificationStatus } from '../../modules/accounts/enums/legal-document-verification-status.enum';
import { REDIS_CLIENT } from '../../config/redis.config';

@Injectable()
export class ClinicLegalDocGuard implements CanActivate {
  private readonly CACHE_TTL_SECONDS = 600;

  constructor(
    private readonly accountsService: AccountsService,
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (
      !user ||
      [
        AccountRole.PATIENT,
        AccountRole.ADMIN,
        AccountRole.CLINIC_ADMIN,
      ].includes(user.role)
    ) {
      return true;
    }

    const accountId = this.extractAccountId(user);

    if (!accountId) {
      throw new ForbiddenException(
        'Unable to validate clinic legal documents for this account.',
      );
    }

    const account = await this.accountsService.findAccountEntityById(accountId);

    if (account.role === AccountRole.CLINIC_MANAGER) {
      await this.ensureManagerLegalDocumentsApproved(account._id);
      return true;
    }

    if (
      account.role === AccountRole.CLINIC_STAFF ||
      account.role === AccountRole.DOCTOR
    ) {
      if (!account.parentId) {
        throw new ForbiddenException(
          'Account hierarchy error. No parent clinic manager found.',
        );
      }

      const parentManager = await this.accountsService.findAccountEntityById(
        account.parentId,
      );

      if (parentManager.role !== AccountRole.CLINIC_MANAGER) {
        throw new ForbiddenException(
          'Account hierarchy error. Parent account is not a clinic manager.',
        );
      }

      await this.ensureManagerLegalDocumentsApproved(parentManager._id);
    }

    return true;
  }

  private extractAccountId(user: Record<string, any>): string | undefined {
    return user.sub || user.uId || user.userId || user._id;
  }

  private getManagerLegalDocCacheKey(managerAccountId: string): string {
    return `guard:clinic-legal-doc:${managerAccountId}`;
  }

  private async ensureManagerLegalDocumentsApproved(
    managerAccountId: string,
  ): Promise<void> {
    const cacheKey = this.getManagerLegalDocCacheKey(managerAccountId);

    try {
      const cachedValue = await this.redisClient.get(cacheKey);

      if (cachedValue === 'approved') {
        return;
      }

      if (cachedValue === 'not_approved') {
        throw new ForbiddenException(
          'Manager legal documents are not approved yet. Access is blocked.',
        );
      }
    } catch (error) {
      // Ignore cache read errors and fall back to database.
    }

    const verificationStatus =
      await this.accountsService.getManagerLegalVerificationStatus(
        managerAccountId,
      );
    const isApproved =
      verificationStatus === LegalDocumentVerificationStatus.APPROVED;

    try {
      await this.redisClient.setex(
        cacheKey,
        this.CACHE_TTL_SECONDS,
        isApproved ? 'approved' : 'not_approved',
      );
    } catch (error) {
      // Ignore cache write errors and keep request flow functional.
    }

    if (!isApproved) {
      throw new ForbiddenException(
        'Manager legal documents are not approved yet. Access is blocked.',
      );
    }
  }
}
