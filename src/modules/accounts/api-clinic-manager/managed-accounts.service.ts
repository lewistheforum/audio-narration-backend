import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Account } from '../entities/accounts.entity';
import { AccountRole } from '../enums/account-role.enum';
import { AccountStatus } from '../enums/account-status.enum';
import { BanType } from '../enums/ban-type.enum';
import { BanHistory } from '../entities/ban-history.entity';
import { MailerService } from '../../mailer/mailer.service';

@Injectable()
export class ManagedAccountsService {
  constructor(
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
    @InjectRepository(BanHistory)
    private readonly banHistoryRepository: Repository<BanHistory>,
    private readonly mailerService: MailerService,
  ) {}

  /**
   * Helper to find an account and verify it belongs to the given clinic manager
   */
  private async findAndVerifyAccount(
    managerId: string,
    accountId: string,
  ): Promise<Account> {
    const account = await this.accountRepository.findOne({
      where: {
        _id: accountId,
        role: In([AccountRole.DOCTOR, AccountRole.CLINIC_STAFF]),
      },
      relations: ['generalAccount'],
    });

    if (!account) {
      throw new NotFoundException(
        `Managed account with ID ${accountId} not found.`,
      );
    }

    if (account.parentId !== managerId) {
      throw new ForbiddenException(
        `You do not have permission to manage this account.`,
      );
    }

    return account;
  }

  /**
   * Ban a doctor or staff account
   */
  async banAccount(
    managerId: string,
    accountId: string,
    banDescription?: string,
  ): Promise<any> {
    const account = await this.findAndVerifyAccount(managerId, accountId);

    account.banCounts += 1;
    account.banDescription = banDescription;

    const accountName =
      account.generalAccount?.fullName || account.username || 'Account Holder';

    if (account.banCounts >= 3) {
      account.status = AccountStatus.BAN;

      await this.mailerService.sendAccountBannedEmail(
        account.email,
        accountName,
        banDescription || 'Multiple violations of terms or clinic policies.',
      );
    } else {
      await this.mailerService.sendAccountWarningEmail(
        account.email,
        accountName,
        banDescription || 'Violation of clinic policies.',
        account.banCounts,
      );
    }

    const savedAccount = await this.accountRepository.save(account);

    const banHistory = this.banHistoryRepository.create({
      accountId: savedAccount._id,
      banCounts: savedAccount.banCounts,
      type: savedAccount.banCounts >= 3 ? BanType.BANNED : BanType.WARNING,
      banDescription: banDescription,
    });
    await this.banHistoryRepository.save(banHistory);

    return {
      message:
        savedAccount.banCounts >= 3
          ? 'Account banned'
          : 'Warning issued to account',
      accountId: savedAccount._id,
      banCounts: savedAccount.banCounts,
      status: savedAccount.status,
    };
  }

  /**
   * Unban a doctor or staff account
   */
  async unbanAccount(managerId: string, accountId: string): Promise<any> {
    const account = await this.findAndVerifyAccount(managerId, accountId);

    if (account.status === AccountStatus.BAN) {
      account.status = AccountStatus.ACTIVE;
      account.banCounts = 0;
      account.banDescription = null;

      const accountName =
        account.generalAccount?.fullName ||
        account.username ||
        'Account Holder';
      await this.mailerService.sendAccountUnbannedEmail(
        account.email,
        accountName,
      );
    }

    const savedAccount = await this.accountRepository.save(account);

    const banHistory = this.banHistoryRepository.create({
      accountId: savedAccount._id,
      banCounts: 0,
      type: BanType.UNBANNED,
    });
    await this.banHistoryRepository.save(banHistory);

    return {
      message: 'Account unbanned successfully',
      accountId: savedAccount._id,
      status: savedAccount.status,
    };
  }

  /**
   * Get ban history for a doctor or staff account
   */
  async getBanHistory(
    managerId: string,
    accountId: string,
  ): Promise<BanHistory[]> {
    await this.findAndVerifyAccount(managerId, accountId);

    return this.banHistoryRepository.find({
      where: { accountId: accountId },
      order: { createdAt: 'DESC' },
    });
  }
}
