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
export class ClinicManagersService {
  constructor(
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
    @InjectRepository(BanHistory)
    private readonly banHistoryRepository: Repository<BanHistory>,
    private readonly mailerService: MailerService,
  ) {}

  /**
   * Helper to find a clinic manager and verify it belongs to the given clinic admin
   */
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

  /**
   * Ban a clinic manager
   * Increments ban counts. If >= 3, bans manager and linked doctors/staff.
   */
  async banClinicManager(
    adminId: string,
    managerId: string,
    banDescription?: string,
  ): Promise<any> {
    const manager = await this.findAndVerifyManager(adminId, managerId);

    manager.banCounts += 1;
    manager.banDescription = banDescription;

    const managerName =
      manager.clinicManagerInformation?.clinicBranchName ||
      manager.username ||
      'Clinic Manager';

    if (manager.banCounts >= 3) {
      manager.status = AccountStatus.BAN;

      // Find Doctors & Staff (Children of this Manager)
      const children = await this.accountRepository.find({
        where: {
          parentId: managerId,
          role: In([AccountRole.DOCTOR, AccountRole.CLINIC_STAFF]),
        },
        select: ['_id'],
      });

      const childrenIds = children.map((c) => c._id);

      if (childrenIds.length > 0) {
        await this.accountRepository.update(
          { _id: In(childrenIds) },
          { status: AccountStatus.BAN },
        );
      }

      await this.mailerService.sendAccountBannedEmail(
        manager.email,
        managerName,
        banDescription || 'Multiple violations of terms or clinic policies.',
      );
    } else {
      await this.mailerService.sendAccountWarningEmail(
        manager.email,
        managerName,
        banDescription || 'Violation of clinic policies.',
        manager.banCounts,
      );
    }

    const savedManager = await this.accountRepository.save(manager);

    const banHistory = this.banHistoryRepository.create({
      accountId: savedManager._id,
      banCounts: savedManager.banCounts,
      type: savedManager.banCounts >= 3 ? BanType.BANNED : BanType.WARNING,
      banDescription: banDescription,
    });
    await this.banHistoryRepository.save(banHistory);

    return {
      message:
        savedManager.banCounts >= 3
          ? 'Clinic manager and associated accounts banned'
          : 'Warning issued to clinic manager',
      managerId: savedManager._id,
      banCounts: savedManager.banCounts,
      status: savedManager.status,
    };
  }

  /**
   * Unban a clinic manager
   * Resets status to ACTIVE and ban counts to 0. Also restores linked doctors/staff.
   */
  async unbanClinicManager(adminId: string, managerId: string): Promise<any> {
    const manager = await this.findAndVerifyManager(adminId, managerId);

    if (manager.status === AccountStatus.BAN) {
      manager.status = AccountStatus.ACTIVE;
      manager.banCounts = 0;
      manager.banDescription = null;

      // Find Doctors & Staff and restore
      const children = await this.accountRepository.find({
        where: {
          parentId: managerId,
          role: In([AccountRole.DOCTOR, AccountRole.CLINIC_STAFF]),
        },
        select: ['_id'],
      });

      const childrenIds = children.map((c) => c._id);

      if (childrenIds.length > 0) {
        await this.accountRepository.update(
          { _id: In(childrenIds) },
          { status: AccountStatus.ACTIVE },
        );
      }

      const managerName =
        manager.clinicManagerInformation?.clinicBranchName ||
        manager.username ||
        'Clinic Manager';
      await this.mailerService.sendAccountUnbannedEmail(
        manager.email,
        managerName,
      );
    }

    const savedManager = await this.accountRepository.save(manager);

    const banHistory = this.banHistoryRepository.create({
      accountId: savedManager._id,
      banCounts: 0,
      type: BanType.UNBANNED,
    });
    await this.banHistoryRepository.save(banHistory);

    return {
      message: 'Clinic manager and associated accounts unbanned',
      managerId: savedManager._id,
      status: savedManager.status,
    };
  }

  /**
   * Get ban history for a clinic manager
   */
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
