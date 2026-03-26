import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from '../entities/accounts.entity';
import { AccountRole } from '../enums/account-role.enum';
import { AccountStatus } from '../enums/account-status.enum';
import { BanType } from '../enums/ban-type.enum';
import { BanHistory } from '../entities/ban-history.entity';
import { MailerService } from '../../mailer/mailer.service';

export interface BanClinicManagerResultDto {
  message: string;
  managerId: string;
  banCounts: number;
  status: AccountStatus;
}

export interface UnbanClinicManagerResultDto {
  message: string;
  managerId: string;
  status: AccountStatus;
}

@Injectable()
export class ClinicManagersService {
  constructor(
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
    @InjectRepository(BanHistory)
    private readonly banHistoryRepository: Repository<BanHistory>,
    private readonly mailerService: MailerService,
  ) {}

  private async findAndVerifyManager(
    adminId: string,
    managerId: string,
  ): Promise<Account> {
    const manager = await this.accountRepository.findOne({
      where: { _id: managerId, role: AccountRole.CLINIC_MANAGER },
      relations: ['clinicManagerInformation'],
    });

    if (!manager) {
      throw new NotFoundException(
        `Clinic manager with ID ${managerId} not found.`,
      );
    }

    if (manager.parentId !== adminId) {
      throw new ForbiddenException(
        `You do not have permission to manage this clinic manager.`,
      );
    }

    return manager;
  }

  async banClinicManager(
    adminId: string,
    managerId: string,
    banDescription?: string,
  ): Promise<BanClinicManagerResultDto> {
    const manager = await this.findAndVerifyManager(adminId, managerId);

    manager.banCounts += 1;
    manager.banDescription = banDescription;

    const managerName =
      manager.clinicManagerInformation?.clinicBranchName ||
      manager.username ||
      'Clinic Manager';

    if (manager.banCounts >= 3) {
      manager.status = AccountStatus.BAN;

      const children = await this.accountRepository
        .createQueryBuilder('account')
        .where('account.parentId = :managerId', { managerId })
        .andWhere('account.role = ANY(:roles)', {
          roles: [AccountRole.DOCTOR, AccountRole.CLINIC_STAFF],
        })
        .select(['account._id'])
        .getMany();

      const childrenIds = children.map((c) => c._id);

      if (childrenIds.length > 0) {
        await this.accountRepository
          .createQueryBuilder()
          .update(Account)
          .set({ status: AccountStatus.BAN })
          .where('_id = ANY(:childrenIds)', { childrenIds })
          .execute();
      }

      await this.accountRepository.save(manager);

      await this.mailerService.sendAccountBannedEmail(
        manager.email,
        managerName,
        banDescription || 'Multiple violations of terms or clinic policies.',
      );
    } else {
      await this.accountRepository.save(manager);

      await this.mailerService.sendAccountWarningEmail(
        manager.email,
        managerName,
        banDescription || 'Violation of clinic policies.',
        manager.banCounts,
      );
    }

    const banHistory = this.banHistoryRepository.create({
      accountId: manager._id,
      banCounts: manager.banCounts,
      type: manager.banCounts >= 3 ? BanType.BANNED : BanType.WARNING,
      banDescription: banDescription,
    });
    await this.banHistoryRepository.save(banHistory);

    return {
      message:
        manager.banCounts >= 3
          ? 'Clinic manager and associated accounts banned'
          : 'Warning issued to clinic manager',
      managerId: manager._id,
      banCounts: manager.banCounts,
      status: manager.status,
    };
  }

  async unbanClinicManager(
    adminId: string,
    managerId: string,
  ): Promise<UnbanClinicManagerResultDto> {
    const manager = await this.findAndVerifyManager(adminId, managerId);

    if (manager.status === AccountStatus.BAN) {
      manager.status = AccountStatus.ACTIVE;
      manager.banCounts = 0;
      manager.banDescription = null;

      const children = await this.accountRepository
        .createQueryBuilder('account')
        .where('account.parentId = :managerId', { managerId })
        .andWhere('account.role = ANY(:roles)', {
          roles: [AccountRole.DOCTOR, AccountRole.CLINIC_STAFF],
        })
        .select(['account._id'])
        .getMany();

      const childrenIds = children.map((c) => c._id);

      if (childrenIds.length > 0) {
        await this.accountRepository
          .createQueryBuilder()
          .update(Account)
          .set({ status: AccountStatus.ACTIVE })
          .where('_id = ANY(:childrenIds)', { childrenIds })
          .execute();
      }

      await this.accountRepository.save(manager);

      const managerName =
        manager.clinicManagerInformation?.clinicBranchName ||
        manager.username ||
        'Clinic Manager';
      await this.mailerService.sendAccountUnbannedEmail(
        manager.email,
        managerName,
      );
    }

    const banHistory = this.banHistoryRepository.create({
      accountId: manager._id,
      banCounts: 0,
      type: BanType.UNBANNED,
    });
    await this.banHistoryRepository.save(banHistory);

    return {
      message: 'Clinic manager and associated accounts unbanned',
      managerId: manager._id,
      status: manager.status,
    };
  }

  async getBanHistory(
    adminId: string,
    managerId: string,
  ): Promise<BanHistory[]> {
    await this.findAndVerifyManager(adminId, managerId);

    return this.banHistoryRepository.find({
      where: { accountId: managerId },
      order: { createdAt: 'DESC' },
    });
  }
}
